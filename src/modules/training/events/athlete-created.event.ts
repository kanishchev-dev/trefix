export class AthleteCreatedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly userId: string,
  ) {}
}
