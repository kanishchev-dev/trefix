export class AthleteStateUpdatedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly stateId: string,
    public readonly confidence: number,
  ) {}
}
