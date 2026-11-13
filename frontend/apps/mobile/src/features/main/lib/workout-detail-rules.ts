import {
  type CompleteWorkoutInput,
  type WorkoutStatus,
} from "@trefix/api-client";

type WorkoutLike = {
  status: WorkoutStatus;
  type: string;
  planId?: string | null;
};

export type WorkoutActions = {
  isCompleted: boolean;
  isCancelled: boolean;
  /** Future workout of the plan in progress: can be moved, changed or removed. */
  isEditable: boolean;
  /** Workout of the plan in progress that is history now. */
  isLocked: boolean;
  /** Manual completion; available whatever the plan status, Strava may be missing. */
  canComplete: boolean;
  /** Today's run can be recorded with the tracker. */
  canRecord: boolean;
};

export function getWorkoutActions(
  workout: WorkoutLike,
  workoutDate: string,
  today: string,
  activePlanId: string | null,
  isRecorderActive: boolean,
): WorkoutActions {
  const isCancelled = workout.status === "cancelled";
  const isActivePlanWorkout =
    Boolean(workout.planId) && workout.planId === activePlanId;
  const isPending = workout.status === "planned";
  const isEditable = isActivePlanWorkout && isPending && workoutDate >= today;

  return {
    isCompleted: workout.status === "completed",
    isCancelled,
    isEditable,
    isLocked: isActivePlanWorkout && !isEditable && !isCancelled,
    canComplete:
      (isPending || workout.status === "skipped") && workoutDate <= today,
    canRecord:
      isPending &&
      workoutDate === today &&
      workout.type !== "rest" &&
      !isRecorderActive,
  };
}

export type CompletionForm = {
  distanceKm: string;
  durationMinutes: string;
  heartRate: string;
  rpe: string;
  notes: string;
};

/** Validated completion payload, or which field is wrong. */
export function parseCompletionForm(
  form: CompletionForm,
):
  | { ok: true; input: CompleteWorkoutInput }
  | { ok: false; field: "distance" | "duration" } {
  const distance = parseFloat(form.distanceKm);
  if (Number.isNaN(distance) || distance <= 0) {
    return { ok: false, field: "distance" };
  }
  const duration = parseInt(form.durationMinutes, 10);
  if (Number.isNaN(duration) || duration <= 0) {
    return { ok: false, field: "duration" };
  }
  const heartRate = parseInt(form.heartRate, 10);
  const rpe = parseInt(form.rpe, 10);
  return {
    ok: true,
    input: {
      actualDistanceKm: distance,
      actualDurationMinutes: duration,
      actualAverageHeartRate: Number.isNaN(heartRate) ? undefined : heartRate,
      rpe: Number.isNaN(rpe) ? undefined : rpe,
      notes: form.notes.trim() || undefined,
    },
  };
}
