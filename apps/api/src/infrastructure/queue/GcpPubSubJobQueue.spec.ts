import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GcpPubSubJobQueue } from './GcpPubSubJobQueue.js';
import { IngestionJobMessage } from '../../modules/bids/application/IJobQueue.js';

const mockPublishMessage = vi.fn();
const mockTopic = vi.fn().mockImplementation(() => ({
  publishMessage: mockPublishMessage,
}));

const mockPull = vi.fn();
const mockAcknowledge = vi.fn();
const mockModifyAckDeadline = vi.fn();
const mockSubscriptionPath = vi
  .fn()
  .mockImplementation((proj: string, sub: string) => `projects/${proj}/subscriptions/${sub}`);

vi.mock('@google-cloud/pubsub', () => {
  return {
    PubSub: vi.fn().mockImplementation(function () {
      return {
        topic: mockTopic,
      };
    }),
    v1: {
      SubscriberClient: vi.fn().mockImplementation(function () {
        return {
          subscriptionPath: mockSubscriptionPath,
          pull: mockPull,
          acknowledge: mockAcknowledge,
          modifyAckDeadline: mockModifyAckDeadline,
        };
      }),
    },
  };
});

describe('GcpPubSubJobQueue (Google Cloud Pub/Sub Adapter)', () => {
  let queue: GcpPubSubJobQueue;

  beforeEach(() => {
    vi.clearAllMocks();
    queue = new GcpPubSubJobQueue({
      topicName: 'tenderpulse-ingestion-jobs-dev',
      subscriptionName: 'tenderpulse-ingestion-sub-dev',
      dlqTopicName: 'tenderpulse-ingestion-dlq-dev',
      dlqSubscriptionName: 'tenderpulse-ingestion-dlq-sub-dev',
      projectId: 'tenderpulse-gcp-test',
    });
  });

  describe('enqueue', () => {
    it('should publish serialized JSON payload to Pub/Sub topic', async () => {
      const payload: IngestionJobMessage = {
        jobId: 'job-101',
        organizationId: 'org-acme',
        bidId: 'bid-202',
        documentId: 'doc-303',
        timestamp: '2026-10-03T18:00:00.000Z',
      };

      await queue.enqueue(payload);

      expect(mockTopic).toHaveBeenCalledWith('tenderpulse-ingestion-jobs-dev');
      expect(mockPublishMessage).toHaveBeenCalledWith({
        data: Buffer.from(JSON.stringify(payload)),
      });
    });
  });

  describe('receiveMessages', () => {
    it('should pull messages from subscription and return formatted QueueMessage array', async () => {
      const payload: IngestionJobMessage = {
        jobId: 'job-101',
        organizationId: 'org-acme',
        bidId: 'bid-202',
        documentId: 'doc-303',
        timestamp: '2026-10-03T18:00:00.000Z',
      };

      mockPull.mockResolvedValueOnce([
        {
          receivedMessages: [
            {
              ackId: 'ack-token-12345',
              deliveryAttempt: 2,
              message: {
                data: Buffer.from(JSON.stringify(payload)),
              },
            },
          ],
        },
      ]);

      const messages = await queue.receiveMessages(5, 120);

      expect(mockSubscriptionPath).toHaveBeenCalledWith(
        'tenderpulse-gcp-test',
        'tenderpulse-ingestion-sub-dev',
      );
      expect(mockPull).toHaveBeenCalledWith({
        subscription: 'projects/tenderpulse-gcp-test/subscriptions/tenderpulse-ingestion-sub-dev',
        maxMessages: 5,
      });
      expect(mockModifyAckDeadline).toHaveBeenCalledWith({
        subscription: 'projects/tenderpulse-gcp-test/subscriptions/tenderpulse-ingestion-sub-dev',
        ackIds: ['ack-token-12345'],
        ackDeadlineSeconds: 120,
      });
      expect(messages).toHaveLength(1);
      expect(messages[0]!.receiptHandle).toBe('ack-token-12345');
      expect(messages[0]!.body.jobId).toBe('job-101');
      expect(messages[0]!.receiveCount).toBe(2);
    });

    it('should return empty array when pull returns no messages', async () => {
      mockPull.mockResolvedValueOnce([{ receivedMessages: [] }]);

      const messages = await queue.receiveMessages(10, 300);

      expect(messages).toEqual([]);
      expect(mockModifyAckDeadline).not.toHaveBeenCalled();
    });
  });

  describe('deleteMessage', () => {
    it('should acknowledge the message with the subscriber client', async () => {
      await queue.deleteMessage('ack-token-12345');

      expect(mockAcknowledge).toHaveBeenCalledWith({
        subscription: 'projects/tenderpulse-gcp-test/subscriptions/tenderpulse-ingestion-sub-dev',
        ackIds: ['ack-token-12345'],
      });
    });
  });

  describe('changeMessageVisibility', () => {
    it('should modify the ack deadline for the receipt handle', async () => {
      await queue.changeMessageVisibility('ack-token-12345', 180);

      expect(mockModifyAckDeadline).toHaveBeenCalledWith({
        subscription: 'projects/tenderpulse-gcp-test/subscriptions/tenderpulse-ingestion-sub-dev',
        ackIds: ['ack-token-12345'],
        ackDeadlineSeconds: 180,
      });
    });
  });

  describe('moveToDeadLetter & getDeadLetterMessages', () => {
    it('should fail rather than acknowledge work when no dead-letter topic is configured', async () => {
      const queueWithoutDlq = new GcpPubSubJobQueue({
        topicName: 'tenderpulse-ingestion-jobs-dev',
        subscriptionName: 'tenderpulse-ingestion-sub-dev',
        projectId: 'tenderpulse-gcp-test',
      });

      await expect(
        queueWithoutDlq.moveToDeadLetter(
          {
            jobId: 'job-999',
            organizationId: 'org-acme',
            bidId: 'bid-202',
            documentId: 'doc-303',
            timestamp: '2026-10-03T18:00:00.000Z',
          },
          'permanent failure',
          3,
        ),
      ).rejects.toThrow('GCP_PUBSUB_DLQ_TOPIC is not configured');
    });

    it('should publish dead letter payload with reason and failed timestamp', async () => {
      const payload: IngestionJobMessage = {
        jobId: 'job-999',
        organizationId: 'org-acme',
        bidId: 'bid-202',
        documentId: 'doc-303',
        timestamp: '2026-10-03T18:00:00.000Z',
      };

      await queue.moveToDeadLetter(payload, 'Extraction failed permanently', 3);

      expect(mockTopic).toHaveBeenCalledWith('tenderpulse-ingestion-dlq-dev');
      expect(mockPublishMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.any(Buffer),
        }),
      );
    });

    it('should pull and format dead letter messages', async () => {
      const deadLetterPayload = {
        message: {
          jobId: 'job-999',
          organizationId: 'org-acme',
          bidId: 'bid-202',
          documentId: 'doc-303',
          timestamp: '2026-10-03T18:00:00.000Z',
        },
        reason: 'Permanent error',
        failedAt: '2026-10-03T18:10:00.000Z',
        receiveCount: 3,
      };

      mockPull.mockResolvedValueOnce([
        {
          receivedMessages: [
            {
              ackId: 'dlq-ack-1',
              message: {
                data: Buffer.from(JSON.stringify(deadLetterPayload)),
              },
            },
          ],
        },
      ]);

      const dlqMessages = await queue.getDeadLetterMessages();

      expect(dlqMessages).toHaveLength(1);
      expect(dlqMessages[0]!.message.jobId).toBe('job-999');
      expect(dlqMessages[0]!.reason).toBe('Permanent error');
      expect(dlqMessages[0]!.receiveCount).toBe(3);
    });
  });
});
