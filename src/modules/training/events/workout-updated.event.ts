/** Fields of a workout an update may touch. */
export type WorkoutUpdatedField = 'scheduledAt' | 'type' | 'durationMinutes' | 'distanceKm' | 'status' | 'title';

/** Emitted after the planned attributes of a single workout change. */
export class WorkoutUpdatedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly workoutId: string,
    public readonly planId: string | null,
    /** User who performed the change; differs from the athlete's user for admin edits. */
    public readonly actorUserId: string,
    public readonly changedFields: readonly WorkoutUpdatedField[],
  ) {}
}
