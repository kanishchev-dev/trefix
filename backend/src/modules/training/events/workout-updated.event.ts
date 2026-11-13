import type { FieldChanges } from '@/common/utils/field-changes.util';

/** Fields of a workout an update may touch. */
export type WorkoutUpdatedField =
  'scheduledAt' | 'type' | 'durationMinutes' | 'distanceKm' | 'status' | 'title' | 'actual';

/** Emitted after the planned attributes of a single workout change. */
export class WorkoutUpdatedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly workoutId: string,
    public readonly planId: string | null,
    /** User who performed the change; differs from the athlete's user for admin edits. */
    public readonly actorUserId: string,
    public readonly changedFields: readonly WorkoutUpdatedField[],
    /** Before and after values of `changedFields`. */
    public readonly changes: FieldChanges | null = null,
  ) {}
}

/** Values of the editable workout fields, the input of `diffFields` for `WorkoutUpdatedEvent`. */
export function snapshotWorkoutFields(workout: {
  scheduledAt: Date;
  type: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  status: string;
  target: Record<string, unknown> | null;
  actual: Record<string, unknown> | null;
}): Record<WorkoutUpdatedField, unknown> {
  const title = workout.target?.['title'];
  return {
    scheduledAt: workout.scheduledAt,
    type: workout.type,
    durationMinutes: workout.durationMinutes,
    distanceKm: workout.distanceKm,
    status: workout.status,
    title: typeof title === 'string' ? title : null,
    actual: workout.actual,
  };
}
