/** Payload of `integrations.activity_updated`, `integrations.activity_merged`, `integrations.activity_source_removed`. */
export class ActivitySourceChangedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly workoutId: string,
    public readonly sourceProvider: string,
    public readonly sourceActivityId: string,
    public readonly gearExternalId: string | null = null,
  ) {}
}
