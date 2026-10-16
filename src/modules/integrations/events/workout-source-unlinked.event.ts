/** An administrator detached a provider record from a workout. */
export class WorkoutSourceUnlinkedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly workoutId: string,
    public readonly provider: string,
  ) {}
}
