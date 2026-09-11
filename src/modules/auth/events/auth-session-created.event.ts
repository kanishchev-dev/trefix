export class AuthSessionCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly sessionId: string,
  ) {}
}
