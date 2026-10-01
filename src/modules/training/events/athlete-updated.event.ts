export class AthleteUpdatedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly actorUserId: string,
  ) {}
}
