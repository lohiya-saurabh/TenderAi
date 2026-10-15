import { v4 as uuidv4 } from 'uuid';
import {
  IJobQueue,
  IngestionJobMessage,
  QueueMessage,
  DeadLetterMessage,
} from '@/modules/bids/application/IJobQueue.js';

interface InternalQueueItem {
  id: string;
  receiptHandle: string | null;
  body: IngestionJobMessage;
  receiveCount: number;
  visibleAt: number;
}

export class MockSqsJobQueue implements IJobQueue {
  private readonly messages: Map<string, InternalQueueItem> = new Map();
  private readonly deadLetterQueue: DeadLetterMessage<IngestionJobMessage>[] = [];

  constructor(public readonly maxReceiveCount = 3) {}

  public async enqueue(payload: IngestionJobMessage): Promise<void> {
    const id = uuidv4();
    this.messages.set(id, {
      id,
      receiptHandle: null,
      body: payload,
      receiveCount: 0,
      visibleAt: Date.now(),
    });
  }

  public async receiveMessages(
    maxMessages = 10,
    visibilityTimeoutSeconds = 300,
  ): Promise<QueueMessage<IngestionJobMessage>[]> {
    const now = Date.now();
    const result: QueueMessage<IngestionJobMessage>[] = [];

    for (const item of this.messages.values()) {
      if (result.length >= maxMessages) break;

      if (item.visibleAt <= now) {
        item.receiveCount += 1;

        if (item.receiveCount > this.maxReceiveCount) {
          // Automatic Dead-Letter Queue routing after max receive count exceeded
          this.deadLetterQueue.push({
            message: item.body,
            reason: `Exceeded maximum receive count of ${this.maxReceiveCount}`,
            failedAt: new Date(),
            receiveCount: item.receiveCount,
          });
          this.messages.delete(item.id);
          continue;
        }

        const handle = uuidv4();
        item.receiptHandle = handle;
        item.visibleAt = now + visibilityTimeoutSeconds * 1000;

        result.push({
          receiptHandle: handle,
          body: item.body,
          receiveCount: item.receiveCount,
        });
      }
    }

    return result;
  }

  public async deleteMessage(receiptHandle: string): Promise<void> {
    for (const [id, item] of this.messages.entries()) {
      if (item.receiptHandle === receiptHandle) {
        this.messages.delete(id);
        return;
      }
    }
  }

  public async changeMessageVisibility(
    receiptHandle: string,
    visibilityTimeoutSeconds: number,
  ): Promise<void> {
    for (const item of this.messages.values()) {
      if (item.receiptHandle === receiptHandle) {
        item.visibleAt = Date.now() + visibilityTimeoutSeconds * 1000;
        return;
      }
    }
  }

  public async moveToDeadLetter(
    message: IngestionJobMessage,
    reason: string,
    receiveCount = 1,
  ): Promise<void> {
    // Remove from active queue if present
    for (const [id, item] of this.messages.entries()) {
      if (item.body.jobId === message.jobId) {
        this.messages.delete(id);
        break;
      }
    }

    this.deadLetterQueue.push({
      message,
      reason,
      failedAt: new Date(),
      receiveCount,
    });
  }

  public async getDeadLetterMessages(): Promise<DeadLetterMessage<IngestionJobMessage>[]> {
    return [...this.deadLetterQueue];
  }

  /**
   * Test Helper: Simulates worker crash / visibility timeout expiration
   */
  public simulateVisibilityExpiration(receiptHandle?: string): void {
    for (const item of this.messages.values()) {
      if (!receiptHandle || item.receiptHandle === receiptHandle) {
        item.visibleAt = Date.now() - 1000; // make immediately visible
        if (receiptHandle) return;
      }
    }
  }

  public getActiveMessageCount(): number {
    return this.messages.size;
  }

  public clear(): void {
    this.messages.clear();
    this.deadLetterQueue.length = 0;
  }
}
