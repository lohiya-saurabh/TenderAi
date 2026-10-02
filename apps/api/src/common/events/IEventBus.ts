import { IDomainEvent } from '../domain/DomainEvent.js';

export type DomainEventHandler<T extends IDomainEvent = IDomainEvent> = (event: T) => Promise<void>;

export interface IEventBus {
  publish(event: IDomainEvent): Promise<void>;
  publishBatch(events: IDomainEvent[]): Promise<void>;
  subscribe<T extends IDomainEvent = IDomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): void;
  unsubscribe<T extends IDomainEvent = IDomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): void;
}
