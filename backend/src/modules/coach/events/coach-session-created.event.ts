export class CoachSessionCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly athleteId: string,
    public readonly sessionId: string,
  ) {}
}
