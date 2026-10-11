import { z } from "zod";

import {
  ADMIN_WORKOUT_EDITABLE_STATUSES,
  ADMIN_WORKOUT_LIMITS,
  WORKOUT_TYPES,
  type AdminCalendarWorkout,
  type AdminCreateWorkoutInput,
  type AdminUpdateWorkoutInput,
} from "@workspace/api-client";

import {
  parseDateKey,
  toDateKey,
  toScheduledAt,
  toTimeValue,
} from "./calendar-dates";

/** Default start time of a new workout: a typical morning run. */
export const DEFAULT_WORKOUT_TIME = "07:00";
export const DEFAULT_WORKOUT_DURATION_MINUTES = 30;
export const DEFAULT_WORKOUT_DISTANCE_KM = 5;

/** Error messages are i18n keys resolved by the form. */
const ERROR_KEYS = {
  date: "trainingCalendar.form.errors.date",
  time: "trainingCalendar.form.errors.time",
  duration: "trainingCalendar.form.errors.duration",
  distance: "trainingCalendar.form.errors.distance",
  title: "trainingCalendar.form.errors.title",
} as const;

// Built with the app's own zod: schemas from the api-client package belong to another zod major and cannot be composed here.
export const workoutFormSchema = z.object({
  date: z
    .string()
    .refine((value) => parseDateKey(value) !== null, ERROR_KEYS.date),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, ERROR_KEYS.time),
  type: z.enum(WORKOUT_TYPES),
  status: z.enum(ADMIN_WORKOUT_EDITABLE_STATUSES),
  durationMinutes: z
    .number({ error: ERROR_KEYS.duration })
    .min(ADMIN_WORKOUT_LIMITS.durationMinutes.min, ERROR_KEYS.duration)
    .max(ADMIN_WORKOUT_LIMITS.durationMinutes.max, ERROR_KEYS.duration),
  distanceKm: z
    .number({ error: ERROR_KEYS.distance })
    .min(ADMIN_WORKOUT_LIMITS.distanceKm.min, ERROR_KEYS.distance)
    .max(ADMIN_WORKOUT_LIMITS.distanceKm.max, ERROR_KEYS.distance),
  title: z
    .string()
    .trim()
    .max(ADMIN_WORKOUT_LIMITS.titleMaxLength, ERROR_KEYS.title),
});

export type WorkoutFormValues = z.infer<typeof workoutFormSchema>;

export function getCreateFormDefaults(day: Date): WorkoutFormValues {
  return {
    date: toDateKey(day),
    time: DEFAULT_WORKOUT_TIME,
    type: "easy",
    status: "planned",
    durationMinutes: DEFAULT_WORKOUT_DURATION_MINUTES,
    distanceKm: DEFAULT_WORKOUT_DISTANCE_KM,
    title: "",
  };
}

/**
 * Prefills the edit form. A workout can only be opened for editing in an
 * editable status, so anything else (skipped is the only other option) maps
 * to itself and `planned` is the safe default.
 */
export function getEditFormDefaults(
  workout: AdminCalendarWorkout,
): WorkoutFormValues {
  const scheduledAt = new Date(workout.scheduledAt);

  return {
    date: toDateKey(scheduledAt),
    time: toTimeValue(scheduledAt),
    type: workout.type,
    status: workout.status === "skipped" ? "skipped" : "planned",
    durationMinutes: workout.durationMinutes,
    distanceKm: workout.distanceKm,
    title: workout.title ?? "",
  };
}

export function toCreateInput(
  values: WorkoutFormValues,
): AdminCreateWorkoutInput {
  const title = values.title.trim();

  return {
    scheduledAt: requireScheduledAt(values),
    type: values.type,
    status: values.status,
    durationMinutes: values.durationMinutes,
    distanceKm: values.distanceKm,
    title: title.length > 0 ? title : undefined,
  };
}

/** Sends only what differs from the workout, so the backend event lists the real changes. */
export function toUpdateInput(
  values: WorkoutFormValues,
  workout: AdminCalendarWorkout,
): AdminUpdateWorkoutInput {
  const initial = getEditFormDefaults(workout);
  const input: AdminUpdateWorkoutInput = {};

  if (values.date !== initial.date || values.time !== initial.time) {
    input.scheduledAt = requireScheduledAt(values);
  }
  if (values.type !== initial.type) {
    input.type = values.type;
  }
  if (values.status !== workout.status) {
    input.status = values.status;
  }
  if (values.durationMinutes !== initial.durationMinutes) {
    input.durationMinutes = values.durationMinutes;
  }
  if (values.distanceKm !== initial.distanceKm) {
    input.distanceKm = values.distanceKm;
  }

  const title = values.title.trim();
  // The backend has no "clear title" operation: an emptied title keeps the current one.
  if (title.length > 0 && title !== initial.title) {
    input.title = title;
  }

  return input;
}

function requireScheduledAt(values: WorkoutFormValues): string {
  const scheduledAt = toScheduledAt(values.date, values.time);
  if (!scheduledAt) {
    throw new Error(
      "Workout form values passed validation with an invalid date or time",
    );
  }
  return scheduledAt;
}
