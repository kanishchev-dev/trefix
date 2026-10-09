export class ActivityImportedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly workoutId: string,
    public readonly sourceProvider: string,
    public readonly sourceActivityId: string,
    public readonly gearExternalId: string | null = null,
  ) {}
}
