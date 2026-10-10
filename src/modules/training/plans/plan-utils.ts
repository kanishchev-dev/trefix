import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

import type { GoalView } from '../interfaces/training-views.interface';
import { PLAN_START_MAX_DAYS_AHEAD } from '../training.constants';

/** Extracts the local calendar date (YYYY-MM-DD) for an instant and timezone. */
export function todayIsoInTz(timezone?: string | null): string {
  const tz = resolveTimezone(timezone);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Resolves and validates an IANA timezone, falling back to UTC. */
export function resolveTimezone(timezone?: string | null): string {
  if (!timezone) {
    return 'UTC';
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return timezone;
  } catch {
    return 'UTC';
  }
}

/** Validates an ISO date string, returning the normalized YYYY-MM-DD form. */
export function parseIsoDate(value: string, code = 'PLAN_START_DATE_INVALID'): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainException(code, `Invalid date: ${value}`, HttpStatus.BAD_REQUEST);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new DomainException(code, `Invalid date: ${value}`, HttpStatus.BAD_REQUEST);
  }
  return value;
}

export function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Validates a start date against the athlete's today and the one-year-ahead
 * cap. Throws `PLAN_START_DATE_INVALID` when violated.
 */
export function ensureStartDateAllowed(startDate: string, timezone?: string | null): void {
  const today = todayIsoInTz(timezone);
  const maxDate = addDaysIso(today, PLAN_START_MAX_DAYS_AHEAD);
  if (startDate < today || startDate > maxDate) {
    throw new DomainException(
      'PLAN_START_DATE_INVALID',
      `Start date must be between ${today} and ${maxDate}`,
      HttpStatus.BAD_REQUEST,
    );
  }
}

/**
 * Validates the goal target date: it must not be before the
 * start date.
 */
export function ensureGoalTargetDateAllowed(startDate: string, goalTargetDate: string): void {
  if (goalTargetDate < startDate) {
    throw new DomainException(
      'PLAN_START_DATE_INVALID',
      'Goal target date cannot be before the start date',
      HttpStatus.BAD_REQUEST,
    );
  }
}

/** Human-readable goal summary used as the default plan name. */
export function resolveGoalSummaryTitle(goal: GoalView | null | undefined): string {
  if (!goal) {
    return 'Training Plan';
  }

  if (goal.type === 'custom' && goal.payload?.description) {
    return goal.payload.description;
  }

  const target = goal.payload?.target ?? {};
  const formatTime = (secs: number): string => {
    const mins = Math.floor(secs / 60);
    const s = Math.abs(Math.round(secs % 60));
    return `${mins}:${String(s).padStart(2, '0')}`;
  };

  const distanceMeters = typeof target.distanceMeters === 'number' ? target.distanceMeters : null;
  const finishTimeSec = typeof target.finishTimeSec === 'number' ? target.finishTimeSec : null;
  if (distanceMeters) {
    const distanceKm = Math.round(distanceMeters / 100) / 10;
    return finishTimeSec ? `${distanceKm} km · ${formatTime(finishTimeSec)}` : `${distanceKm} km goal`;
  }

  const runsPerWeek = typeof target.runsPerWeek === 'number' ? target.runsPerWeek : null;
  if (runsPerWeek) {
    return `${runsPerWeek} runs/week`;
  }

  const weightKg = typeof target.weightKg === 'number' ? target.weightKg : null;
  if (weightKg) {
    return `${weightKg} kg goal`;
  }

  return goal.type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/** Monday-first weekday index of a Date. */
export function mondayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

/** Label for metrics computed from workouts: the strongest external source among them, else manual logging. */
export function workoutsMetricsSource(
  providers: ReadonlyArray<string | null | undefined>,
): 'strava' | 'health' | 'manual_workouts' {
  if (providers.includes('strava')) {
    return 'strava';
  }
  if (providers.some((provider) => provider === 'apple_health' || provider === 'health_connect')) {
    return 'health';
  }
  return 'manual_workouts';
}
