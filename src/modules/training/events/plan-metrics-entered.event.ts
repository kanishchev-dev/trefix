/** Metrics the user typed while creating or rebuilding a plan; they are written back to the profile. */
export class PlanMetricsEnteredEvent {
  constructor(
    public readonly athleteId: string,
    public readonly metrics: {
      restingHeartRate?: number | null;
      maxHeartRate?: number | null;
      thresholdHeartRate?: number | null;
      weeklyMileageKm?: number | null;
    },
  ) {}
}
