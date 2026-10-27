export interface IngestionJobMessage {
  jobId: string;
  organizationId: string;
  companyId?: string;
  bidId: string;
  documentId: string;
  workflowRunId?: string;
  traceId?: string;
  correlationId?: string;
  storageReference?: string;
  documentType?: string;
  fileName?: string;
  timestamp: string;
}

export interface QueueMessage<T> {
  receiptHandle: string;
  body: T;
  receiveCount: number;
}

export interface DeadLetterMessage<T> {
  message: T;
  reason: string;
  failedAt: Date;
  receiveCount: number;
}

export interface IJobQueue {
  enqueue(payload: IngestionJobMessage): Promise<void>;

  receiveMessages(
    maxMessages?: number,
    visibilityTimeoutSeconds?: number,
    /** abortSignal cancels an in-flight long poll (graceful shutdown). */
    options?: { abortSignal?: AbortSignal },
  ): Promise<QueueMessage<IngestionJobMessage>[]>;

  deleteMessage(receiptHandle: string): Promise<void>;

  changeMessageVisibility(receiptHandle: string, visibilityTimeoutSeconds: number): Promise<void>;

  moveToDeadLetter(
    message: IngestionJobMessage,
    reason: string,
    receiveCount?: number,
  ): Promise<void>;

  getDeadLetterMessages(): Promise<DeadLetterMessage<IngestionJobMessage>[]>;
}
