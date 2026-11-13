/** Emitted after a workout is added to an athlete calendar outside of the plan builder. */
export class WorkoutCreatedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly workoutId: string,
    public readonly planId: string | null,
    /** User who performed the change; differs from the athlete's user for admin edits. */
    public readonly actorUserId: string,
  ) {}
}
