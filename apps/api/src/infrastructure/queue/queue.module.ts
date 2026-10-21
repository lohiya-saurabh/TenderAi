/**
 * QueueModule — Provides IJobQueue as an injectable global provider.
 *
 * Resolves SQS or Pub/Sub configuration from environment,
 * falling back to MockSqsJobQueue for local in-memory execution and testing.
 */
import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
      useFactory: (configService: ConfigService): IJobQueue => {
        const logger = new Logger('QueueModule:Ingestion');
        const queueProvider = configService.get<string>('QUEUE_PROVIDER');
        const allowMock = configService.get<string>('ALLOW_MOCK_SERVICES');
        if (queueProvider === 'mock' || allowMock === 'true') {
          return new MockSqsJobQueue();
        }

        const queueUrl =
          configService.get<string>('AWS_SQS_INGESTION_QUEUE_URL') ||
          configService.get<string>('AWS_SQS_QUEUE_URL');
        if (queueUrl) {
          const service = new AwsSqsJobQueue({
            queueUrl,
            dlqUrl: configService.get<string>('AWS_SQS_DLQ_URL'),
            region: configService.get<string>('AWS_REGION') || 'ap-south-1',
          });
          logger.log(`Connected to AWS SQS ingestion queue: ${queueUrl}`);
          return service;
        }

        const gcpProjectId = configService.get<string>('GCP_PROJECT_ID');
        const gcpTopic = configService.get<string>('GCP_PUBSUB_TOPIC');
        const gcpSub = configService.get<string>('GCP_PUBSUB_SUBSCRIPTION');
        if (gcpProjectId && gcpTopic && gcpSub) {
          const service = new GcpPubSubJobQueue({
            projectId: gcpProjectId,
            topicName: gcpTopic,
            subscriptionName: gcpSub,
            dlqTopicName: configService.get<string>('GCP_PUBSUB_DLQ_TOPIC'),
          });
          logger.log(
            `Connected to GCP Pub/Sub ingestion: topic=${gcpTopic}, sub=${gcpSub}`,
          );
          return service;
        }

        const nodeEnv = configService.get<string>('NODE_ENV');
        if (nodeEnv === 'production') {
          throw new Error(
            'A production message queue must be configured with AWS_SQS_QUEUE_URL or GCP Pub/Sub settings.',
          );
        }

        return new MockSqsJobQueue();
      },
      inject: [ConfigService],
    },
    {
      provide: COMPLETION_QUEUE_TOKEN,
      useFactory: (configService: ConfigService): IJobQueue => {
        const logger = new Logger('QueueModule:Completion');
        const queueProvider = configService.get<string>('QUEUE_PROVIDER');
        const allowMock = configService.get<string>('ALLOW_MOCK_SERVICES');
        if (queueProvider === 'mock' || allowMock === 'true') {
          return new MockSqsJobQueue();
        }

        const completionQueueUrl = configService.get<string>('AWS_SQS_COMPLETION_QUEUE_URL');
        if (completionQueueUrl) {
          const service = new AwsSqsJobQueue({
            queueUrl: completionQueueUrl,
            dlqUrl: configService.get<string>('AWS_SQS_COMPLETION_DLQ_URL'),
            region: configService.get<string>('AWS_REGION') || 'ap-south-1',
          });
          logger.log(`Connected to AWS SQS completion queue: ${completionQueueUrl}`);
          return service;
        }

        const gcpProjectId = configService.get<string>('GCP_PROJECT_ID');
        const gcpCompletionTopic = configService.get<string>('GCP_PUBSUB_COMPLETION_TOPIC');
        const gcpCompletionSub = configService.get<string>('GCP_PUBSUB_COMPLETION_SUBSCRIPTION');
        if (gcpProjectId && gcpCompletionTopic && gcpCompletionSub) {
          const service = new GcpPubSubJobQueue({
            projectId: gcpProjectId,
            topicName: gcpCompletionTopic,
            subscriptionName: gcpCompletionSub,
            dlqTopicName: configService.get<string>('GCP_PUBSUB_COMPLETION_DLQ_TOPIC'),
          });
          logger.log(
            `Connected to GCP Pub/Sub completion: topic=${gcpCompletionTopic}, sub=${gcpCompletionSub}`,
          );
          return service;
        }

        return new MockSqsJobQueue();
      },
      inject: [ConfigService],
    },
  ],
  exports: [QUEUE_TOKEN, COMPLETION_QUEUE_TOKEN],
})
export class QueueModule {}
