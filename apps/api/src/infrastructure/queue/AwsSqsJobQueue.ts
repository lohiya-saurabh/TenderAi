import {
  SQSClient,
  SendMessageCommand,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
} from '@aws-sdk/client-sqs';
import {
  IJobQueue,
  IngestionJobMessage,
  QueueMessage,
  DeadLetterMessage,
} from '../../modules/bids/application/IJobQueue.js';

export interface AwsSqsConfig {
  queueUrl: string;
  dlqUrl?: string;
  region?: string;
  endpoint?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export class AwsSqsJobQueue implements IJobQueue {
  private readonly sqsClient: SQSClient;
  private readonly queueUrl: string;
  private readonly dlqUrl?: string;

  constructor(config: AwsSqsConfig) {
    this.queueUrl = config.queueUrl;
    this.dlqUrl = config.dlqUrl;
    this.sqsClient = new SQSClient({
      region: config.region || process.env.AWS_REGION || 'ap-south-1',
      endpoint: config.endpoint || process.env.SQS_ENDPOINT || undefined,
      credentials: config.credentials || (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY ? {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      } : undefined),
    });
  }

  public async enqueue(payload: IngestionJobMessage): Promise<void> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(payload),
    });

    await this.sqsClient.send(command);
  }

  public async receiveMessages(
    maxMessages = 10,
    visibilityTimeoutSeconds = 300
  ): Promise<QueueMessage<IngestionJobMessage>[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: Math.min(Math.max(1, maxMessages), 10),
      VisibilityTimeout: visibilityTimeoutSeconds,
      WaitTimeSeconds: 20, // Long polling
      MessageSystemAttributeNames: ['ApproximateReceiveCount'],
    });

    const response = await this.sqsClient.send(command);
    if (!response.Messages || response.Messages.length === 0) {
      return [];
    }

    const messages: QueueMessage<IngestionJobMessage>[] = [];

    for (const msg of response.Messages) {
      if (!msg.ReceiptHandle || !msg.Body) continue;

      try {
        const parsedBody = JSON.parse(msg.Body) as IngestionJobMessage;
        const receiveCount = Number(msg.Attributes?.ApproximateReceiveCount) || 1;

        messages.push({
          receiptHandle: msg.ReceiptHandle,
          body: parsedBody,
          receiveCount,
        });
      } catch (error) {
        throw new Error('SQS message body is not valid JSON.', { cause: error });
      }
    }

    return messages;
  }

  public async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
    });

    await this.sqsClient.send(command);
  }

  public async changeMessageVisibility(
    receiptHandle: string,
    visibilityTimeoutSeconds: number
  ): Promise<void> {
    const command = new ChangeMessageVisibilityCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle,
      VisibilityTimeout: visibilityTimeoutSeconds,
    });

    await this.sqsClient.send(command);
  }

  public async moveToDeadLetter(
    message: IngestionJobMessage,
    reason: string,
    receiveCount = 1
  ): Promise<void> {
    if (!this.dlqUrl) {
      throw new Error('Cannot move an SQS message to the dead-letter queue: AWS_SQS_DLQ_URL is not configured.');
    }

    const deadLetterPayload = {
      message,
      reason,
      failedAt: new Date().toISOString(),
      receiveCount,
    };

    const command = new SendMessageCommand({
      QueueUrl: this.dlqUrl,
      MessageBody: JSON.stringify(deadLetterPayload),
    });

    await this.sqsClient.send(command);
  }

  public async getDeadLetterMessages(): Promise<DeadLetterMessage<IngestionJobMessage>[]> {
    if (!this.dlqUrl) {
      return [];
    }

    const command = new ReceiveMessageCommand({
      QueueUrl: this.dlqUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 1,
      VisibilityTimeout: 30,
    });

    const response = await this.sqsClient.send(command);
    if (!response.Messages || response.Messages.length === 0) {
      return [];
    }

    const results: DeadLetterMessage<IngestionJobMessage>[] = [];

    for (const msg of response.Messages) {
      if (!msg.Body) continue;
      try {
        const parsed = JSON.parse(msg.Body) as {
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
  }
}
