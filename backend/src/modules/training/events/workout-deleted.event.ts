/** Emitted after a workout the user added by hand is removed from their calendar. */
export class WorkoutDeletedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly workoutId: string,
    public readonly planId: string | null,
    public readonly actorUserId: string,
  ) {}
}
