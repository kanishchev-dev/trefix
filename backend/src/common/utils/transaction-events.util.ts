import { EventEmitter2 } from '@nestjs/event-emitter';
import { Transaction } from 'sequelize';

/**
 * Publishes a domain event once the data it describes is durable.
 *
 * Inside a transaction a listener would otherwise react to (and re-read) rows
 * that may still roll back; outside one the event goes out immediately.
 */
export function emitAfterCommit(
  eventEmitter: EventEmitter2,
  transaction: Transaction | undefined,
  event: string,
  payload: unknown,
): void {
  if (transaction) {
    transaction.afterCommit(() => {
      eventEmitter.emit(event, payload);
    });
    return;
  }
  eventEmitter.emit(event, payload);
}
