import { SYSTEM_PERMISSION_CATALOG } from '@/modules/permissions/constants/system-access.constants';

import type { AnalyticsScope } from './analytics-period';

/** Admin-panel permissions: whoever holds one is staff and is left out of the metrics by default. */
export const ADMIN_PERMISSION_KEYS: readonly string[] = SYSTEM_PERMISSION_CATALOG.filter(
  (permission) => permission.adminOnly,
).map((permission) => permission.key);

/**
 * `eligible` CTE: real (non-system, not deleted) users with their athlete id.
 * Staff are excluded unless `:includeStaff` is true. Every dashboard query
 * starts from it so all blocks count the same people.
 */
export const ELIGIBLE_CTE = `eligible AS (
  SELECT u.id AS user_id, u.created_at AS registered_at, a.id AS athlete_id
    FROM users u
    LEFT JOIN athletes a ON a.user_id = u.id AND a.deleted_at IS NULL
   WHERE u.deleted_at IS NULL
     AND u.is_system = false
     AND (:includeStaff OR NOT EXISTS (
       SELECT 1
         FROM user_permission_groups upg
         JOIN permission_group_permissions pgp ON pgp.permission_group_id = upg.permission_group_id
         JOIN permissions p ON p.id = pgp.permission_id AND p.deleted_at IS NULL
        WHERE upg.user_id = u.id AND p.name IN (:adminKeys)
       UNION ALL
       SELECT 1
         FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id AND p.deleted_at IS NULL
        WHERE up.user_id = u.id AND p.name IN (:adminKeys)
     ))
)`;

/** A completed workout that counts as training (rest days do not). */
export const COMPLETED_WORKOUT = `w.deleted_at IS NULL AND w.status = 'completed' AND w.type <> 'rest' AND w.completed_at IS NOT NULL`;

/** Actual distance and duration of a workout, falling back to the plan. */
export const WORKOUT_KM = `COALESCE((w.actual->>'actualDistanceKm')::numeric, w.distance_km, 0)`;
export const WORKOUT_MINUTES = `COALESCE((w.actual->>'actualDurationMinutes')::numeric, w.duration_minutes, 0)`;

/** Local calendar day of a timestamp column in the request timezone. */
export function localDay(column: string): string {
  return `(${column} AT TIME ZONE :tz)::date`;
}

/** Monday of the local week of a timestamp column. */
export function localWeek(column: string): string {
  return `date_trunc('week', ${column} AT TIME ZONE :tz)::date`;
}

/** Replacements every dashboard query understands. */
export function scopeReplacements(scope: AnalyticsScope): Record<string, unknown> {
  return {
    tz: scope.timezone,
    includeStaff: scope.includeStaff,
    adminKeys: ADMIN_PERMISSION_KEYS,
    today: scope.today,
    from: scope.from,
    to: scope.to,
    prevFrom: scope.prevFrom,
    prevTo: scope.prevTo,
  };
}

/** Postgres returns COUNT and NUMERIC as strings. */
export function toNumber(value: unknown): number {
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : 0;
}

export function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? parsed : null;
}

/** Date column as a date key whatever the driver returned. */
export function toDateKey(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}
