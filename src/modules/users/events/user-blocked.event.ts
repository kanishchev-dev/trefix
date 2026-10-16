import type { UserBlockReason } from '../user-status';

export class UserBlockedEvent {
  constructor(
    public readonly userId: string,
    public readonly reason: UserBlockReason,
    public readonly until: Date | null,
    /** Whether every active session must be ended right away. */
    public readonly revokeSessions: boolean,
  ) {}
}

export class UserUnblockedEvent {
  constructor(public readonly userId: string) {}
}

export class UserRestoredEvent {
  constructor(public readonly userId: string) {}
}
