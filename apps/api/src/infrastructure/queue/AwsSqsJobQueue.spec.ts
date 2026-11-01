import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AwsSqsJobQueue } from '@/infrastructure/queue/AwsSqsJobQueue.js';
import {
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} from '@aws-sdk/client-sqs';

describe('AwsSqsJobQueue', () => {
  let jobQueue: AwsSqsJobQueue;
  let mockSend: ReturnType<typeof vi.fn>;

  const mockPayload = {
    jobId: 'job-123',
    organizationId: 'org-456',
    bidId: 'bid-789',
    documentId: 'doc-001',
    timestamp: '2026-10-03T10:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    jobQueue = new AwsSqsJobQueue({
      queueUrl: 'https://sqs.ap-south-1.amazonaws.com/123456789012/test-queue',
      dlqUrl: 'https://sqs.ap-south-1.amazonaws.com/123456789012/test-dlq',
      region: 'ap-south-1',
    });
    mockSend = vi.fn();
    (jobQueue as unknown as { sqsClient: { send: unknown } }).sqsClient.send = mockSend;
  });

  describe('enqueue', () => {
    it('should send serialized JSON payload to SQS queue URL', async () => {
      mockSend.mockResolvedValueOnce({ MessageId: 'msg-1' });

      await jobQueue.enqueue(mockPayload);

      expect(mockSend).toHaveBeenCalledWith(expect.any(SendMessageCommand));
      const command = mockSend.mock.calls[0][0] as SendMessageCommand;
      expect(command.input.QueueUrl).toBe(
        'https://sqs.ap-south-1.amazonaws.com/123456789012/test-queue',
      );
      expect(JSON.parse(command.input.MessageBody!)).toEqual(mockPayload);
    });
  });

  describe('receiveMessages', () => {
    it('should parse received SQS messages and extract receipt handles and receive counts', async () => {
      mockSend.mockResolvedValueOnce({
        Messages: [
          {
            ReceiptHandle: 'handle-123',
            Body: JSON.stringify(mockPayload),
            Attributes: {
              ApproximateReceiveCount: '2',
            },
          },
        ],
      });

      const shutdown = new AbortController();
      const messages = await jobQueue.receiveMessages(5, 120, { abortSignal: shutdown.signal });

      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        receiptHandle: 'handle-123',
        body: mockPayload,
        receiveCount: 2,
      });
      // The abort signal reaches the SDK so shutdown can cancel an in-flight long poll.
      expect(mockSend).toHaveBeenCalledWith(expect.any(ReceiveMessageCommand), {
        abortSignal: shutdown.signal,
      });
      const command = mockSend.mock.calls[0][0] as ReceiveMessageCommand;
      expect(command.input.MaxNumberOfMessages).toBe(5);
      expect(command.input.VisibilityTimeout).toBe(120);
    });

    it('should return empty array when no messages are returned', async () => {
      mockSend.mockResolvedValueOnce({ Messages: [] });

      const messages = await jobQueue.receiveMessages();

      expect(messages).toEqual([]);
    });
  });

  describe('deleteMessage', () => {
    it('should invoke DeleteMessageCommand with queue URL and receipt handle', async () => {
      mockSend.mockResolvedValueOnce({});

      await jobQueue.deleteMessage('handle-to-delete');

      expect(mockSend).toHaveBeenCalledWith(expect.any(DeleteMessageCommand));
      const command = mockSend.mock.calls[0][0] as DeleteMessageCommand;
      expect(command.input.QueueUrl).toBe(
        'https://sqs.ap-south-1.amazonaws.com/123456789012/test-queue',
      );
      expect(command.input.ReceiptHandle).toBe('handle-to-delete');
    });
  });

  describe('changeMessageVisibility', () => {
    it('should invoke ChangeMessageVisibilityCommand with timeout seconds', async () => {
      mockSend.mockResolvedValueOnce({});

      await jobQueue.changeMessageVisibility('handle-extend', 60);

      expect(mockSend).toHaveBeenCalledWith(expect.any(ChangeMessageVisibilityCommand));
      const command = mockSend.mock.calls[0][0] as ChangeMessageVisibilityCommand;
      expect(command.input.ReceiptHandle).toBe('handle-extend');
      expect(command.input.VisibilityTimeout).toBe(60);
    });
  });

  describe('moveToDeadLetter', () => {
    it('should fail rather than acknowledge work when no dead-letter queue is configured', async () => {
      const queueWithoutDlq = new AwsSqsJobQueue({
        queueUrl: 'https://sqs.ap-south-1.amazonaws.com/123456789012/test-queue',
        region: 'ap-south-1',
      });

      await expect(
        queueWithoutDlq.moveToDeadLetter(mockPayload, 'permanent failure', 3),
      ).rejects.toThrow('AWS_SQS_DLQ_URL is not configured');
    });

    it('should send failure payload to DLQ URL', async () => {
      mockSend.mockResolvedValueOnce({ MessageId: 'dlq-msg-1' });

      await jobQueue.moveToDeadLetter(mockPayload, 'Parsing timed out after 3 retries', 3);

      expect(mockSend).toHaveBeenCalledWith(expect.any(SendMessageCommand));
      const command = mockSend.mock.calls[0][0] as SendMessageCommand;
      expect(command.input.QueueUrl).toBe(
        'https://sqs.ap-south-1.amazonaws.com/123456789012/test-dlq',
      );
      const parsedBody = JSON.parse(command.input.MessageBody!);
      expect(parsedBody.message).toEqual(mockPayload);
      expect(parsedBody.reason).toBe('Parsing timed out after 3 retries');
      expect(parsedBody.receiveCount).toBe(3);
    });
  });
});
