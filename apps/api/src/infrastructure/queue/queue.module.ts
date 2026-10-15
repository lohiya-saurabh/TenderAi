/**
 * QueueModule — Provides IJobQueue as an injectable global provider.
 *
 * Resolves SQS or Pub/Sub configuration from environment,
 * falling back to MockSqsJobQueue for local in-memory execution and testing.
 */
import { Module, Global, Logger } from '@nestjs/common';
import type { IJobQueue } from '@/modules/bids/application/IJobQueue.js';
import { AwsSqsJobQueue } from '@/infrastructure/queue/AwsSqsJobQueue.js';
import { GcpPubSubJobQueue } from '@/infrastructure/queue/GcpPubSubJobQueue.js';
import { MockSqsJobQueue } from '@/infrastructure/queue/MockSqsJobQueue.js';

export const QUEUE_TOKEN = 'JOB_QUEUE';
export const INGESTION_QUEUE_TOKEN = 'JOB_QUEUE';
export const COMPLETION_QUEUE_TOKEN = 'COMPLETION_QUEUE';

@Global()
@Module({
  providers: [
    {
      provide: QUEUE_TOKEN,
      useFactory: (): IJobQueue => {
        const logger = new Logger('QueueModule:Ingestion');
        const queueUrl = process.env.AWS_SQS_INGESTION_QUEUE_URL || process.env.AWS_SQS_QUEUE_URL;
        if (queueUrl) {
          const service = new AwsSqsJobQueue({
            queueUrl,
            dlqUrl: process.env.AWS_SQS_DLQ_URL,
            region: process.env.AWS_REGION || 'ap-south-1',
          });
          logger.log(`Connected to AWS SQS ingestion queue: ${queueUrl}`);
          return service;
        }

        if (
          process.env.GCP_PROJECT_ID &&
          process.env.GCP_PUBSUB_TOPIC &&
          process.env.GCP_PUBSUB_SUBSCRIPTION
        ) {
          const service = new GcpPubSubJobQueue({
            projectId: process.env.GCP_PROJECT_ID,
            topicName: process.env.GCP_PUBSUB_TOPIC,
            subscriptionName: process.env.GCP_PUBSUB_SUBSCRIPTION,
            dlqTopicName: process.env.GCP_PUBSUB_DLQ_TOPIC,
          });
          logger.log(
            `Connected to GCP Pub/Sub ingestion: topic=${process.env.GCP_PUBSUB_TOPIC}, sub=${process.env.GCP_PUBSUB_SUBSCRIPTION}`,
          );
          return service;
        }

        if (process.env.QUEUE_PROVIDER === 'mock' || process.env.ALLOW_MOCK_SERVICES === 'true') {
          return new MockSqsJobQueue();
        }

        if (process.env.NODE_ENV === 'production') {
          throw new Error(
            'A production message queue must be configured with AWS_SQS_QUEUE_URL or GCP Pub/Sub settings.',
          );
        }

        return new MockSqsJobQueue();
      },
    },
    {
      provide: COMPLETION_QUEUE_TOKEN,
      useFactory: (): IJobQueue => {
        const logger = new Logger('QueueModule:Completion');
        if (process.env.AWS_SQS_COMPLETION_QUEUE_URL) {
          const service = new AwsSqsJobQueue({
            queueUrl: process.env.AWS_SQS_COMPLETION_QUEUE_URL,
            dlqUrl: process.env.AWS_SQS_COMPLETION_DLQ_URL,
            region: process.env.AWS_REGION || 'ap-south-1',
          });
          logger.log(`Connected to AWS SQS completion queue: ${process.env.AWS_SQS_COMPLETION_QUEUE_URL}`);
          return service;
        }

        if (
          process.env.GCP_PROJECT_ID &&
          process.env.GCP_PUBSUB_COMPLETION_TOPIC &&
          process.env.GCP_PUBSUB_COMPLETION_SUBSCRIPTION
        ) {
          const service = new GcpPubSubJobQueue({
            projectId: process.env.GCP_PROJECT_ID,
            topicName: process.env.GCP_PUBSUB_COMPLETION_TOPIC,
            subscriptionName: process.env.GCP_PUBSUB_COMPLETION_SUBSCRIPTION,
            dlqTopicName: process.env.GCP_PUBSUB_COMPLETION_DLQ_TOPIC,
          });
          logger.log(
            `Connected to GCP Pub/Sub completion: topic=${process.env.GCP_PUBSUB_COMPLETION_TOPIC}, sub=${process.env.GCP_PUBSUB_COMPLETION_SUBSCRIPTION}`,
          );
          return service;
        }

        return new MockSqsJobQueue();
      },
    },
  ],
  exports: [QUEUE_TOKEN, COMPLETION_QUEUE_TOKEN],
})
export class QueueModule {}
