export class CoachReplyGeneratedEvent {
  constructor(
    public readonly userId: string,
    public readonly athleteId: string,
    public readonly sessionId: string,
    public readonly messageId: string,
  ) {}
}
