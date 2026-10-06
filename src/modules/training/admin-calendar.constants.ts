/**
 * Admin calendar operations.
 *
 * The admin panel edits any athlete's calendar on behalf of the platform, so
 * the guardrails differ from the self-service flow: past dates are allowed
 * (history correction), while completed facts stay immutable.
 */

import { MANUAL_PLAN_MAX_DISTANCE_KM, MANUAL_PLAN_MAX_DURATION_MINUTES, WorkoutStatus } from './training.constants';

/** Events emitted when the admin mutates a workout. */
export const ADMIN_WORKOUT_EVENT_NAMES = {
  created: 'training.workout.created',
  updated: 'training.workout.updated',
} as const;

/**
 * Statuses the admin panel may set. `completed` requires an actual result and
 * load recalculation, and `cancelled` is a plan lifecycle outcome — both stay
 * with the athlete flow.
 */
export const ADMIN_WORKOUT_EDITABLE_STATUSES = ['planned', 'skipped'] as const satisfies readonly WorkoutStatus[];
export type AdminWorkoutEditableStatus = (typeof ADMIN_WORKOUT_EDITABLE_STATUSES)[number];

/** Maximum number of workouts listed for a single calendar day. */
export const ADMIN_CALENDAR_DAY_MAX_WORKOUTS = 50;

/** Longest range (inclusive, in days) the month summary may cover: a month grid with leading/trailing weeks. */
export const ADMIN_CALENDAR_SUMMARY_MAX_DAYS = 62;

/** Default workout values used when the admin panel omits optional fields. */
export const ADMIN_WORKOUT_DEFAULTS = {
  durationMinutes: 30,
  distanceKm: 5,
} as const;

/** Bounds accepted from the admin panel for numeric workout fields. */
export const ADMIN_WORKOUT_FIELD_RANGES = {
  durationMinutes: { min: 1, max: MANUAL_PLAN_MAX_DURATION_MINUTES },
  distanceKm: { min: 0, max: MANUAL_PLAN_MAX_DISTANCE_KM },
  titleMaxLength: 120,
} as const;

/** Phase assigned to workouts created outside of a plan. */
export const ADMIN_WORKOUT_ADHOC_PHASE = 'adhoc';

/** Marks workouts created from the admin panel in `target.source` / `sourceProvider`. */
export const ADMIN_WORKOUT_SOURCE = 'admin';

/** Machine-readable error codes of the admin calendar. */
export const ADMIN_CALENDAR_ERROR_CODES = {
  workoutCompletedImmutable: 'WORKOUT_COMPLETED_IMMUTABLE',
  rangeInvalid: 'CALENDAR_RANGE_INVALID',
} as const;
