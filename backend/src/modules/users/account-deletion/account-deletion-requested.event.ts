/** Emitted (and awaited) before the account is deactivated, so integrations can revoke external access. */
export class AccountDeletionRequestedEvent {
  constructor(public readonly userId: string) {}
}
