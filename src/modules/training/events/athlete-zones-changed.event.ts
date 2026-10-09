export class AthleteZonesChangedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly userId: string,
  ) {}
}
