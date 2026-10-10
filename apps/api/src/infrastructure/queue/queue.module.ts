/**
 * QueueModule — Provides IJobQueue as an injectable global provider.
 *
 * Resolves SQS or Pub/Sub configuration from environment,
 * falling back to MockSqsJobQueue for local in-memory execution and testing.
 */
import { Module, Global, Logger } from '@nestjs/common';
import type { IJobQueue } from '../../modules/bids/application/IJobQueue.js';
import { AwsSqsJobQueue } from './AwsSqsJobQueue.js';
import { GcpPubSubJobQueue } from './GcpPubSubJobQueue.js';
import { MockSqsJobQueue } from './MockSqsJobQueue.js';

export const QUEUE_TOKEN = 'JOB_QUEUE';

@Global()
@Module({
  providers: [
    {
      provide: QUEUE_TOKEN,
      useFactory: (): IJobQueue => {
        const logger = new Logger('QueueModule');
        if (process.env.AWS_SQS_QUEUE_URL) {
          const service = new AwsSqsJobQueue({
            queueUrl: process.env.AWS_SQS_QUEUE_URL,
            dlqUrl: process.env.AWS_SQS_DLQ_URL,
            region: process.env.AWS_REGION || 'ap-south-1',
          });
          logger.log(`Connected to AWS SQS queue: ${process.env.AWS_SQS_QUEUE_URL}`);
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
            `Connected to GCP Pub/Sub: topic=${process.env.GCP_PUBSUB_TOPIC}, sub=${process.env.GCP_PUBSUB_SUBSCRIPTION}`,
          );
          return service;
        }

        if (process.env.NODE_ENV === 'production') {
          throw new Error(
            'A production message queue must be configured with AWS_SQS_QUEUE_URL or GCP Pub/Sub settings.',
          );
        }

        return new MockSqsJobQueue();
      },
    },
  ],
  exports: [QUEUE_TOKEN],
})
export class QueueModule { }
