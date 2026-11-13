import type { Workout } from '../entities/workout.entity';
import { RelativeWeek } from '../training.engine';
import type { ChangeContext, ComputedPlanChange, PlanChangesInput, WorkoutPatch } from './plan-change.types';
import { PlanChangeSupport } from './plan-change-support';
import { addDaysIso } from './plan-utils';

/** Training days / long-run day change of the active plan. */
export class ScheduleChange extends PlanChangeSupport {
  compute(context: ChangeContext, input: PlanChangesInput): ComputedPlanChange {
    const schedule = input.schedule;
    if (!schedule || schedule.trainingDays.length === 0) {
      throw this.invalid('schedule.trainingDays is required');
    }

    const days = [...new Set(schedule.trainingDays)].sort((left, right) => left - right);
    const currentWeek = this.statsService.computeCurrentWeek(context.plan, context.today);
    const effectiveFrom = input.effectiveFrom ?? 'next_week';
    const fromWeek = effectiveFrom === 'next_week' ? currentWeek + 1 : Math.max(1, currentWeek);
    const cutoff =
      effectiveFrom === 'next_week'
        ? addDaysIso(context.planStart, (fromWeek - 1) * 7)
        : this.maxIso(addDaysIso(context.today, 1), context.planStart);

    const before = this.project(context);
    const isMovable = (row: Workout): boolean =>
      row.status === 'planned' && this.isoOf(row.scheduledAt) >= cutoff && row.weekNumber >= fromWeek;

    // Only movable sessions are remapped; locked ones keep their days and
    // make those days unavailable for the rest of the week.
    const remapInput: RelativeWeek[] = [];
    const allowedDays = new Map<number, number[]>();
    for (const week of before) {
      if (week.weekNumber < fromWeek) {
        continue;
      }
      const movable = week.workouts.filter((workout) => {
        const row = context.rows.get(workout.key);
        return row ? isMovable(row) : false;
      });
      const lockedDays = new Set(
        week.workouts
          .filter((workout) => !movable.includes(workout) && workout.type !== 'rest')
          .map((workout) => workout.dayOfWeek),
      );
      allowedDays.set(
        week.weekNumber,
        days.filter((day) => !lockedDays.has(day) && this.dayIso(context, week.weekNumber, day) >= cutoff),
      );
      remapInput.push({ ...week, workouts: movable });
    }

    const remap = this.engine.remapSchedule(remapInput, schedule, fromWeek, allowedDays);
    const after = this.clone(before);
    for (const remapped of remap.weeks) {
      const week = this.findWeek(after, remapped.weekNumber);
      const remappedKeys = new Set(
        remapInput.find((entry) => entry.weekNumber === remapped.weekNumber)?.workouts.map((w) => w.key),
      );
      week.workouts = [
        ...week.workouts.filter((workout) => !remappedKeys.has(workout.key)),
        ...this.clone([remapped])[0].workouts,
      ];
    }

    const patches = new Map<string, WorkoutPatch>();
    for (const remapped of remap.weeks) {
      for (const workout of remapped.workouts) {
        patches.set(workout.key, {
          scheduledAt: new Date(`${this.dayIso(context, remapped.weekNumber, workout.dayOfWeek)}T00:00:00Z`),
        });
      }
    }
    this.reorder(after, context, patches, new Map(), new Set(remap.weeks.map((week) => week.weekNumber)));

    const diff = this.engine.diffPlans(before, after);
    this.annotateRemovals(diff, remap.removed);

    const config = context.plan.config;
    return {
      diff,
      warnings: remap.removed.length > 0 ? ['WORKOUTS_REMOVED_NOT_ENOUGH_DAYS'] : [],
      resultingEndDate: context.planEnd,
      mutation: {
        removals: remap.removed.map((entry) => entry.key),
        updates: [...patches.entries()].map(([id, patch]) => ({ id, patch })),
        creations: [],
        config: {
          ...config,
          schedule: {
            ...config.schedule,
            trainingDays: days,
            preferredLongRunDay: schedule.preferredLongRunDay ?? null,
            workoutDurationMinutes: schedule.workoutDurationMinutes ?? null,
          },
        },
        athleteSchedule: { ...schedule, trainingDays: days },
      },
    };
  }
}
