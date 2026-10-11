import { WorkoutView } from '../interfaces/training-views.interface';
import {
  ExtractableWorkout,
  MaterializedWorkout,
  MaterializeOptions,
  MaterializeResult,
  RelativeWeek,
  RelativeWorkout,
  RemapResult,
} from './engine.types';
import {
  addDays,
  cyclicDistance,
  formatDate,
  getWeekIntent,
  getWeekTitle,
  getWorkoutTitle,
  resolvePhase,
  resolveWeekdayDate,
  resolveWeekdayIndex,
  toUtcMidnight,
} from './engine-utils';

/** Session types that must not land on adjacent days. */
const INTENSIVE_WORKOUT_TYPES: readonly string[] = ['tempo', 'threshold', 'interval', 'hill', 'race'];

/*
 * Relative plan weeks on the calendar: materialization, schedule remapping, final version extraction.
 *
 * Pure functions of the training engine: deterministic, no I/O.
 */

/**
 * Plan's final version → relative weeks. Completed workouts contribute their
 * planned values: the history is rebuilt as it was designed, not as it was
 * run. With `keyById` the persisted ids become keys, which lets the editing
 * flow map diff entries back to rows.
 */
export function extractFinalVersion(
  plan: { startDate: string | null; endDate: string | null },
  workouts: ExtractableWorkout[],
  options: { keyById?: boolean } = {},
): RelativeWeek[] {
  if (!plan.startDate) {
    return [];
  }

  const startDate = new Date(`${plan.startDate}T00:00:00Z`);
  const totalWeeks = plan.endDate
    ? Math.max(1, Math.round((new Date(`${plan.endDate}T00:00:00Z`).getTime() - startDate.getTime()) / 86_400_000 / 7))
    : Math.max(1, ...workouts.map((workout) => workout.weekNumber));

  const weekNumbers = new Set(workouts.map((workout) => workout.weekNumber));
  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber += 1) {
    weekNumbers.add(weekNumber);
  }

  return [...weekNumbers]
    .sort((left, right) => left - right)
    .map((weekNumber) => {
      const weekWorkouts = workouts
        .filter((workout) => workout.weekNumber === weekNumber)
        .sort((left, right) =>
          left.scheduledAt.getTime() === right.scheduledAt.getTime()
            ? left.orderInWeek - right.orderInWeek
            : left.scheduledAt.getTime() - right.scheduledAt.getTime(),
        )
        .map((workout, index) => ({
          key: options.keyById && workout.id ? workout.id : `w${weekNumber}-${index + 1}`,
          dayOfWeek: resolveWeekdayIndex(workout.scheduledAt),
          orderInWeek: index + 1,
          type: workout.type as WorkoutView['type'],
          phase: workout.phase,
          title: getWorkoutTitle(workout.type as WorkoutView['type']),
          durationMinutes: workout.durationMinutes,
          distanceKm: workout.distanceKm,
          target: workout.target,
          steps: workout.steps,
        }));

      const phase = weekWorkouts[0]?.phase ?? resolvePhase(weekNumber, totalWeeks);
      return {
        weekNumber,
        phase,
        title: getWeekTitle(phase, weekNumber),
        intent: getWeekIntent(phase, weekNumber),
        workouts: weekWorkouts,
      };
    });
}

/**
 * Relative weeks → dated workouts from startDate. Week numbers are treated
 * as positions relative to `startDate` (week 1 starts on it). When the
 * plan starts mid-week, first-week sessions scheduled before the start
 * weekday move to the nearest free day of that week or are dropped.
 */
export function materializeWeeks(
  weeks: RelativeWeek[],
  startDate: Date,
  options: MaterializeOptions = {},
): MaterializeResult {
  const relocateFirstWeek = options.relocateFirstWeek ?? true;
  const start = toUtcMidnight(startDate);
  const startWeekday = resolveWeekdayIndex(start);
  const totalWeeks = weeks.length;
  const materialized: MaterializedWorkout[] = [];
  const dropped: Array<{ key: string; reason: string }> = [];

  for (const week of [...weeks].sort((left, right) => left.weekNumber - right.weekNumber)) {
    const weekStart = addDays(start, (week.weekNumber - 1) * 7);
    const weekDaysUsed = new Set<number>();

    const ordered = [...week.workouts].sort((left, right) =>
      left.dayOfWeek === right.dayOfWeek ? left.orderInWeek - right.orderInWeek : left.dayOfWeek - right.dayOfWeek,
    );

    for (const workout of ordered) {
      let dayOfWeek = workout.dayOfWeek;

      if (relocateFirstWeek && week.weekNumber === 1 && dayOfWeek < startWeekday) {
        const relocation = findRelocationDay(
          dayOfWeek,
          startWeekday,
          week.workouts.map((entry) => entry.dayOfWeek).filter((day) => day >= startWeekday),
          weekDaysUsed,
        );
        if (relocation === null) {
          dropped.push({ key: workout.key, reason: 'NO_FREE_DAY_IN_WEEK' });
          continue;
        }
        dayOfWeek = relocation;
      }

      weekDaysUsed.add(dayOfWeek);
      materialized.push({
        key: workout.key,
        weekNumber: week.weekNumber,
        scheduledAt: resolveWeekdayDate(weekStart, 1, dayOfWeek),
        orderInWeek: workout.orderInWeek,
        type: workout.type,
        phase: workout.phase,
        durationMinutes: workout.durationMinutes,
        distanceKm: workout.distanceKm,
        target: workout.target,
        steps: workout.steps,
      });
    }
  }

  const datedWeeks = weeks.map((week) => ({
    weekNumber: week.weekNumber,
    phase: week.phase,
    weeklyLoadTarget: week.weeklyLoadTarget ?? 0,
    title: week.title ?? getWeekTitle(week.phase, week.weekNumber),
    intent: week.intent ?? getWeekIntent(week.phase, week.weekNumber),
    workoutIds: materialized.filter((workout) => workout.weekNumber === week.weekNumber).map((workout) => workout.key),
  }));

  return {
    startDate: formatDate(start),
    endDate: formatDate(addDays(start, totalWeeks * 7 - 1)),
    totalWeeks,
    weeks: datedWeeks,
    workouts: materialized,
    dropped,
  };
}

/**
 * Remaps workouts of weeks starting at `fromWeek` onto new training days,
 * keeping keys stable and key sessions in place: the long run goes to its
 * preferred day and intensive sessions are spread apart. When a week has
 * more sessions than days, the least valuable ones (recovery, then easy)
 * are removed with an explicit reason. `allowedDaysByWeek` narrows the days
 * of a particular week (e.g. the current week only keeps upcoming days).
 */
export function remapSchedule(
  weeks: RelativeWeek[],
  schedule: { trainingDays: number[]; preferredLongRunDay?: number | null },
  fromWeek: number,
  allowedDaysByWeek: Map<number, number[]> = new Map(),
): RemapResult {
  const baseDays = [...new Set(schedule.trainingDays)].filter((day) => day >= 0 && day <= 6).sort((a, b) => a - b);
  const removed: Array<{ key: string; reason: string }> = [];

  if (baseDays.length === 0) {
    return { weeks, removed };
  }

  const result = weeks.map((week) => {
    if (week.weekNumber < fromWeek) {
      return week;
    }

    const days = allowedDaysByWeek.get(week.weekNumber) ?? baseDays;
    const movable = week.workouts.filter((workout) => workout.type !== 'rest');
    const rests = week.workouts.filter((workout) => workout.type === 'rest');

    let kept = [...movable];
    while (kept.length > days.length) {
      const victimIndex = kept.findIndex((workout) => workout.type === 'recovery');
      const fallbackIndex = kept.findIndex((workout) => workout.type === 'easy');
      const removeIndex = victimIndex >= 0 ? victimIndex : fallbackIndex >= 0 ? fallbackIndex : kept.length - 1;
      const [victim] = kept.splice(removeIndex, 1);
      removed.push({ key: victim.key, reason: 'NOT_ENOUGH_TRAINING_DAYS' });
    }

    const assignments = assignTrainingDays(kept, days, schedule.preferredLongRunDay ?? null);
    kept = kept
      .map((workout) => ({ ...workout, dayOfWeek: assignments.get(workout.key) ?? workout.dayOfWeek }))
      .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
      .map((workout, index) => ({ ...workout, orderInWeek: index + 1 }));

    return { ...week, workouts: [...kept, ...rests] };
  });

  return { weeks: result, removed };
}

/** Greedy day assignment: long run on its day, intensives spread out. */
function assignTrainingDays(
  workouts: RelativeWorkout[],
  days: number[],
  preferredLongRunDay: number | null,
): Map<string, number> {
  const assignments = new Map<string, number>();
  const free = new Set(days);

  const longRun = workouts.find((workout) => workout.type === 'long_run');
  if (longRun) {
    const day =
      preferredLongRunDay !== null && free.has(preferredLongRunDay) ? preferredLongRunDay : Math.max(...free.values());
    assignments.set(longRun.key, day);
    free.delete(day);
  }

  const intensives = workouts.filter(
    (workout) => workout.type !== 'long_run' && INTENSIVE_WORKOUT_TYPES.includes(workout.type),
  );
  const others = workouts.filter(
    (workout) => workout.type !== 'long_run' && !INTENSIVE_WORKOUT_TYPES.includes(workout.type),
  );

  const assignedIntensiveDays: number[] = [];
  for (const workout of intensives) {
    const day = pickSpreadDay([...free], assignedIntensiveDays);
    if (day === null) {
      break;
    }
    assignments.set(workout.key, day);
    assignedIntensiveDays.push(day);
    free.delete(day);
  }

  for (const workout of others) {
    const day = [...free].sort((left, right) => left - right)[0];
    if (day === undefined) {
      break;
    }
    assignments.set(workout.key, day);
    free.delete(day);
  }

  return assignments;
}

/** Picks the free day with the largest gap to already-assigned intensives. */
function pickSpreadDay(freeDays: number[], assignedIntensiveDays: number[]): number | null {
  if (freeDays.length === 0) {
    return null;
  }

  let bestDay = freeDays[0];
  let bestGap = -1;
  for (const day of freeDays) {
    const gap =
      assignedIntensiveDays.length === 0
        ? 7
        : Math.min(
            ...assignedIntensiveDays.map((assigned) =>
              Math.min(Math.abs(day - assigned), 7 - Math.abs(day - assigned)),
            ),
          );
    if (gap > bestGap) {
      bestGap = gap;
      bestDay = day;
    }
  }
  return bestDay;
}

function findRelocationDay(
  preferredDay: number,
  startWeekday: number,
  weekDays: number[],
  usedDays: Set<number>,
): number | null {
  const candidates = [...new Set(weekDays)].sort(
    (left, right) => cyclicDistance(left, preferredDay) - cyclicDistance(right, preferredDay),
  );
  for (const candidate of candidates) {
    if (!usedDays.has(candidate)) {
      return candidate;
    }
  }

  // Every training day is taken: allow any free weekday on or after the
  // start weekday as a last resort (earlier days are already in the past).
  for (let candidate = startWeekday; candidate <= 6; candidate += 1) {
    if (!usedDays.has(candidate)) {
      return candidate;
    }
  }
  return null;
}
