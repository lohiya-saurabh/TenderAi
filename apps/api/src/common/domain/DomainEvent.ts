import { v4 as uuidv4 } from 'uuid';

export interface IDomainEvent<T = unknown> {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly organizationId: string;
  readonly occurredAt: Date;
  readonly version: number;
  readonly payload: T;
}

export abstract class DomainEvent<T = unknown> implements IDomainEvent<T> {
  public readonly eventId: string;
  public readonly eventType: string;
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly organizationId: string;
  public readonly occurredAt: Date;
  public readonly version: number;
  public readonly payload: T;

  constructor(
    eventType: string,
    aggregateId: string,
    aggregateType: string,
    organizationId: string,
    payload: T,
    version = 1,
    eventId?: string,
    occurredAt?: Date,
  ) {
    this.eventId = eventId ?? uuidv4();
    this.eventType = eventType;
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.organizationId = organizationId;
    this.payload = payload;
    this.version = version;
    this.occurredAt = occurredAt ?? new Date();

    Object.freeze(this);
  }
}
