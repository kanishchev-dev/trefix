import { WorkoutView } from '../interfaces/training-views.interface';
import {
  ATHLETE_GOAL_DISTANCES,
  MANUAL_PLAN_MAX_WEEKS,
  MANUAL_PLAN_MIN_WEEKS,
  WORKOUT_TYPE_INTENSITY_FACTORS,
} from '../training.constants';
import { RelativeWeek } from './engine.types';

/*
 * Calendar arithmetic and small lookups shared by every part of the engine.
 *
 * Pure functions of the training engine: deterministic, no I/O.
 */

export function resolvePhase(weekNumber: number, totalWeeks: number): string {
  if (weekNumber === totalWeeks) {
    return 'race';
  }
  if (weekNumber >= totalWeeks - 1) {
    return 'taper';
  }
  if (weekNumber % 4 === 0) {
    return 'recovery';
  }
  if (weekNumber <= 2) {
    return 'base';
  }
  if (weekNumber <= totalWeeks - 3) {
    return 'build';
  }
  return 'specific';
}

export function resolveDistanceKilometres(distance: string): number {
  const map: Record<(typeof ATHLETE_GOAL_DISTANCES)[number], number> = {
    '5k': 5,
    '10k': 10,
    half_marathon: 21.097,
    marathon: 42.195,
    just_running: 0,
  };

  return map[distance as keyof typeof map] || 0;
}

export function resolveIntensityFactor(workoutType: WorkoutView['type']): number {
  return WORKOUT_TYPE_INTENSITY_FACTORS[workoutType as keyof typeof WORKOUT_TYPE_INTENSITY_FACTORS];
}

export function sumLoadWithin(loads: Array<{ load: number; occurredAt: Date }>, now: Date, days: number): number {
  const lowerBound = now.getTime() - days * 86_400_000;
  return loads.filter((load) => load.occurredAt.getTime() >= lowerBound).reduce((sum, load) => sum + load.load, 0);
}

export function isHardWorkout(type: WorkoutView['type']): boolean {
  return ['tempo', 'threshold', 'interval', 'hill', 'race'].includes(type);
}

export function isQualityWorkout(type: WorkoutView['type']): boolean {
  return ['tempo', 'threshold', 'interval', 'hill'].includes(type);
}

export function cyclicDistance(left: number, right: number): number {
  const distance = Math.abs(left - right);
  return Math.min(distance, 7 - distance);
}

/** Renumbers weeks sequentially; workout keys stay stable. */
export function renumberWeeks(weeks: RelativeWeek[]): RelativeWeek[] {
  return weeks.map((week, index) => ({ ...week, weekNumber: index + 1 }));
}

export function getWeekTitle(phase: string, weekNumber: number): string {
  const p = phase.toLowerCase();
  if (p === 'base') return 'Building consistency';
  if (p === 'build') return 'Increasing training load';
  if (p === 'specific') return 'Race-specific work';
  if (p === 'peak') return 'Peak preparation';
  if (p === 'taper') return 'Reducing load';
  if (p === 'race') return 'Race week';
  if (p === 'recovery') return 'Volume recovery';
  return `Week ${weekNumber} focus`;
}

// The optional week number keeps the signature aligned with getWeekTitle;
// intents today depend on the phase only.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function getWeekIntent(phase: string, _weekNumber?: number): string {
  const p = phase.toLowerCase();
  if (p === 'base') return 'Establish steady running routine and comfortable easy effort aerobic base.';
  if (p === 'build') return 'Build aerobic strength while maintaining recovery between quality sessions.';
  if (p === 'specific') return 'Develop target race pace efficiency and rhythm.';
  if (p === 'peak') return 'Execute final key race simulation session before reducing volume.';
  if (p === 'taper') return 'Shed residual fatigue while preserving neural sharpness.';
  if (p === 'race') return 'Rest, hydrate, carb load and execute your goal race.';
  if (p === 'recovery') return 'Allow body to adapt to previous load while maintaining frequency.';
  return 'Focus on consistent training and proper recovery.';
}

export function getWorkoutTitle(type: WorkoutView['type']): string {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function toUtcMidnight(date: Date): Date {
  if (!Number.isNaN(date.getUTCFullYear())) {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
  return new Date(date);
}

/** Resolves the concrete date of a weekday index within a plan week. */
export function resolveWeekdayDate(startDate: Date, weekNumber: number, dayOfWeek: number): Date {
  const weekStart = addDays(startDate, (weekNumber - 1) * 7);
  const startWeekday = resolveWeekdayIndex(startDate);
  const offset = (dayOfWeek - startWeekday + 7) % 7;
  return addDays(weekStart, offset);
}

/** Clamps a user-selected number of weeks into the supported range. */
export function clampManualWeeks(totalWeeks: number): number {
  return Math.max(MANUAL_PLAN_MIN_WEEKS, Math.min(MANUAL_PLAN_MAX_WEEKS, totalWeeks));
}

/** Monday-first weekday index (0 = Monday ... 6 = Sunday). */
export function resolveWeekdayIndex(date: Date): number {
  return (date.getUTCDay() + 6) % 7;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
