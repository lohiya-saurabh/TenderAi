import { IDomainEvent } from '../domain/DomainEvent.js';
import { IEventBus, DomainEventHandler } from './IEventBus.js';

export class InMemoryEventBus implements IEventBus {
  private readonly handlers: Map<string, Set<DomainEventHandler<IDomainEvent>>> = new Map();
  private readonly publishedHistory: IDomainEvent[] = [];

  public subscribe<T extends IDomainEvent = IDomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler as DomainEventHandler<IDomainEvent>);
  }

  public unsubscribe<T extends IDomainEvent = IDomainEvent>(
    eventType: string,
    handler: DomainEventHandler<T>
  ): void {
    const handlersSet = this.handlers.get(eventType);
    if (handlersSet) {
      handlersSet.delete(handler as DomainEventHandler<IDomainEvent>);
    }
  }

  public async publish(event: IDomainEvent): Promise<void> {
    this.publishedHistory.push(event);

    const handlersSet = this.handlers.get(event.eventType);
    if (!handlersSet || handlersSet.size === 0) {
      return;
    }

    // Execute subscribers concurrently and safely isolate subscriber failures
    const promises = Array.from(handlersSet).map(async (handler) => {
      try {
        await handler(event);
      } catch (err: unknown) {
        // In a production event bus, subscriber errors are logged and routed to an event error queue,
        // without bubbling up to crash the primary publisher transaction.
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(
          `[EventBus] Subscriber error on event '${event.eventType}' (ID: ${event.eventId}): ${errorMessage}`
        );
      }
    });

    await Promise.all(promises);
  }

  public async publishBatch(events: IDomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publish(event);
    }
  }

  public getPublishedEvents(): IDomainEvent[] {
    return [...this.publishedHistory];
  }

  public getEventsByType<T extends IDomainEvent = IDomainEvent>(eventType: string): T[] {
    return this.publishedHistory.filter((e) => e.eventType === eventType) as T[];
  }

  public clear(): void {
    this.publishedHistory.length = 0;
  }

  public resetHandlers(): void {
    this.handlers.clear();
  }
}
