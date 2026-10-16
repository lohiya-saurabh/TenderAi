import { PubSub, ClientConfig, v1 } from '@google-cloud/pubsub';
import {
  IJobQueue,
  IngestionJobMessage,
  QueueMessage,
  DeadLetterMessage,
} from '@/modules/bids/application/IJobQueue.js';
import { StructuredLogger } from '@/common/logging/StructuredLogger.js';
import { LoggingContextHolder } from '@/common/logging/LoggingContext.js';

export interface GcpPubSubConfig {
  topicName: string;
  subscriptionName: string;
  dlqTopicName?: string;
  dlqSubscriptionName?: string;
  projectId?: string;
  keyFilename?: string;
  credentials?: {
    client_email?: string;
    private_key?: string;
  };
  apiEndpoint?: string;
}

export class GcpPubSubJobQueue implements IJobQueue {
  private readonly pubSub: PubSub;
  private readonly subClient: v1.SubscriberClient;
  private readonly topicName: string;
  private readonly subscriptionName: string;
  private readonly dlqTopicName?: string;
  private readonly dlqSubscriptionName?: string;
  private readonly projectId: string;
  private readonly logger = new StructuredLogger('GcpPubSubJobQueue', 'api');

  constructor(config: GcpPubSubConfig) {
    this.topicName = config.topicName;
    this.subscriptionName = config.subscriptionName;
    this.dlqTopicName = config.dlqTopicName;
    this.dlqSubscriptionName = config.dlqSubscriptionName;
    this.projectId = config.projectId || process.env.GCP_PROJECT_ID || 'tenderpulse-local';

    const clientConfig: ClientConfig = {
      projectId: this.projectId,
      keyFilename: config.keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
      apiEndpoint: config.apiEndpoint || process.env.PUBSUB_EMULATOR_HOST || undefined,
    };

    if (config.credentials) {
      clientConfig.credentials = config.credentials;
    }

    this.pubSub = new PubSub(clientConfig);
    this.subClient = new v1.SubscriberClient({
      projectId: this.projectId,
      keyFilename: config.keyFilename || process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
      apiEndpoint: config.apiEndpoint || process.env.PUBSUB_EMULATOR_HOST || undefined,
      credentials: config.credentials,
    });
  }

  public async enqueue(payload: IngestionJobMessage): Promise<void> {
    const context = LoggingContextHolder.get();
    const enrichedPayload: IngestionJobMessage = {
      ...payload,
      traceId: payload.traceId || context.traceId,
      correlationId: payload.correlationId || context.correlationId,
    };

    const topic = this.pubSub.topic(this.topicName);
    const dataBuffer = Buffer.from(JSON.stringify(enrichedPayload));
    await topic.publishMessage({ data: dataBuffer });

    this.logger.info(
      'queue.message.published',
      `Published ingestion job ${payload.jobId} to PubSub`,
      {
        jobId: payload.jobId,
        documentId: payload.documentId,
        bidId: payload.bidId,
      },
      {
        trace_id: enrichedPayload.traceId,
        correlation_id: enrichedPayload.correlationId,
        job_id: payload.jobId,
        document_id: payload.documentId,
        tender_id: payload.bidId,
      },
    );
  }

  public async receiveMessages(
    maxMessages = 10,
    visibilityTimeoutSeconds = 300,
  ): Promise<QueueMessage<IngestionJobMessage>[]> {
    const formattedSubscription = this.subClient.subscriptionPath(
      this.projectId,
      this.subscriptionName,
    );

    try {
      const [response] = await this.subClient.pull({
        subscription: formattedSubscription,
        maxMessages: Math.min(Math.max(1, maxMessages), 10),
      });

      if (!response.receivedMessages || response.receivedMessages.length === 0) {
        return [];
      }

      // Modify ack deadline to match the requested visibility timeout
      const ackIds = response.receivedMessages
        .map((m) => m.ackId)
        .filter((id): id is string => Boolean(id));

      if (ackIds.length > 0 && visibilityTimeoutSeconds > 0) {
        await this.subClient.modifyAckDeadline({
          subscription: formattedSubscription,
          ackIds,
          ackDeadlineSeconds: visibilityTimeoutSeconds,
        });
      }

      const results: QueueMessage<IngestionJobMessage>[] = [];

      for (const msg of response.receivedMessages) {
        if (!msg.ackId || !msg.message?.data) continue;

        try {
          const rawString =
            typeof msg.message.data === 'string'
              ? msg.message.data
              : Buffer.from(msg.message.data as Uint8Array).toString('utf-8');

          const body = JSON.parse(rawString) as IngestionJobMessage;
          const receiveCount = msg.deliveryAttempt ? Number(msg.deliveryAttempt) : 1;

          results.push({
            receiptHandle: msg.ackId,
            body,
            receiveCount,
          });
        } catch (error) {
          throw new Error('Pub/Sub message body is not valid JSON.', { cause: error });
        }
      }

      return results;
    } catch (error) {
      throw new Error(
        `Failed to pull messages from Pub/Sub subscription '${this.subscriptionName}'.`,
        {
          cause: error,
        },
      );
    }
  }

  public async deleteMessage(receiptHandle: string): Promise<void> {
    const formattedSubscription = this.subClient.subscriptionPath(
      this.projectId,
      this.subscriptionName,
    );

    await this.subClient.acknowledge({
      subscription: formattedSubscription,
      ackIds: [receiptHandle],
    });
  }

  public async changeMessageVisibility(
    receiptHandle: string,
    visibilityTimeoutSeconds: number,
  ): Promise<void> {
    const formattedSubscription = this.subClient.subscriptionPath(
      this.projectId,
      this.subscriptionName,
    );

    await this.subClient.modifyAckDeadline({
      subscription: formattedSubscription,
      ackIds: [receiptHandle],
      ackDeadlineSeconds: visibilityTimeoutSeconds,
    });
  }

  public async moveToDeadLetter(
    message: IngestionJobMessage,
    reason: string,
    receiveCount = 1,
  ): Promise<void> {
    if (!this.dlqTopicName) {
      throw new Error(
        'Cannot move a Pub/Sub message to the dead-letter queue: GCP_PUBSUB_DLQ_TOPIC is not configured.',
      );
    }

    const deadLetterPayload = {
      message,
      reason,
      failedAt: new Date().toISOString(),
      receiveCount,
    };

    const dlqTopic = this.pubSub.topic(this.dlqTopicName);
    const dataBuffer = Buffer.from(JSON.stringify(deadLetterPayload));
    await dlqTopic.publishMessage({ data: dataBuffer });
  }

  public async getDeadLetterMessages(): Promise<DeadLetterMessage<IngestionJobMessage>[]> {
    if (!this.dlqSubscriptionName) {
      return [];
    }

    const formattedSubscription = this.subClient.subscriptionPath(
      this.projectId,
      this.dlqSubscriptionName,
    );

    try {
      const [response] = await this.subClient.pull({
        subscription: formattedSubscription,
        maxMessages: 10,
      });

      if (!response.receivedMessages || response.receivedMessages.length === 0) {
        return [];
      }

      const results: DeadLetterMessage<IngestionJobMessage>[] = [];

      for (const msg of response.receivedMessages) {
        if (!msg.message?.data) continue;

        try {
          const rawString =
            typeof msg.message.data === 'string'
              ? msg.message.data
              : Buffer.from(msg.message.data as Uint8Array).toString('utf-8');

          const parsed = JSON.parse(rawString) as {
            message: IngestionJobMessage;
            reason: string;
            failedAt: string;
            receiveCount: number;
          };

          results.push({
            message: parsed.message,
            reason: parsed.reason,
            failedAt: new Date(parsed.failedAt),
            receiveCount: parsed.receiveCount || 1,
          });
        } catch {
          // Skip unparseable messages
        }
      }

      return results;
    } catch {
      return [];
    }
  }
}
