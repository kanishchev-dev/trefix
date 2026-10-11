import { DomainBadRequestException, DomainConflictException } from '@/common/exceptions/domain-exceptions';

import type { Workout } from '../entities/workout.entity';
import type { WorkoutView } from '../interfaces/training-views.interface';
import { PlanDiff, RelativeWeek, RelativeWorkout, TrainingEngine } from '../training.engine';
import type { ChangeContext, WorkoutCreation, WorkoutPatch } from './plan-change.types';
import { PlanStatsService } from './plan-stats.service';
import { addDaysIso, mondayIndex, parseIsoDate } from './plan-utils';

/**
 * Shared helpers of the plan change calculators: projection of the active plan,
 * reordering, validation and date arithmetic. Subclasses hold no state.
 */
export abstract class PlanChangeSupport {
  constructor(
    protected readonly engine: TrainingEngine,
    protected readonly statsService: PlanStatsService,
  ) {}

  /** Relative projection of the active plan keyed by workout id. */
  protected project(context: ChangeContext): RelativeWeek[] {
    const weeks = this.engine.extractFinalVersion(
      { startDate: context.planStart, endDate: context.planEnd },
      [...context.rows.values()].map((row) => ({
        id: row.id,
        weekNumber: row.weekNumber,
        orderInWeek: row.orderInWeek,
        scheduledAt: row.scheduledAt,
        type: row.type,
        phase: row.phase,
        durationMinutes: row.durationMinutes,
        distanceKm: row.distanceKm,
        target: (row.target as Record<string, unknown>) ?? {},
        steps: (row.steps as Array<Record<string, unknown>>) ?? [],
      })),
      { keyById: true },
    );

    // Keep the stored week metadata (phase, load target) instead of re-deriving it.
    const stored = new Map(
      (context.plan.weeks ?? []).map((week) => [Number(week.weekNumber), week as Record<string, unknown>]),
    );
    return weeks.map((week) => {
      const meta = stored.get(week.weekNumber);
      return meta
        ? {
            ...week,
            phase: String(meta.phase ?? week.phase),
            title: (meta.title as string | undefined) ?? week.title,
            intent: (meta.intent as string | undefined) ?? week.intent,
            weeklyLoadTarget: Number(meta.weeklyLoadTarget ?? 0),
          }
        : week;
    });
  }

  /** Recomputes order in week for the touched weeks and records changed orders. */
  protected reorder(
    weeks: RelativeWeek[],
    context: ChangeContext,
    patches: Map<string, WorkoutPatch>,
    created: Map<string, WorkoutCreation>,
    touchedWeeks: Set<number>,
  ): void {
    for (const week of weeks) {
      if (!touchedWeeks.has(week.weekNumber)) {
        continue;
      }
      week.workouts.sort((left, right) =>
        left.dayOfWeek === right.dayOfWeek ? left.orderInWeek - right.orderInWeek : left.dayOfWeek - right.dayOfWeek,
      );
      week.workouts.forEach((workout, index) => {
        const order = index + 1;
        workout.orderInWeek = order;
        const creation = created.get(workout.key);
        if (creation) {
          creation.orderInWeek = order;
          return;
        }
        const row = context.rows.get(workout.key);
        if (!row) {
          return;
        }
        const patch = patches.get(workout.key);
        const weekChanged = patch?.weekNumber !== undefined && patch.weekNumber !== row.weekNumber;
        if (row.orderInWeek !== order || weekChanged || patch) {
          patches.set(workout.key, { ...(patch ?? {}), orderInWeek: order });
        }
      });
    }
  }

  protected annotateRemovals(diff: PlanDiff, removed: Array<{ key: string; reason: string }>): void {
    const reasons = new Map(removed.map((entry) => [entry.key, entry.reason]));
    for (const week of diff.weeks) {
      for (const workout of week.workouts) {
        const reason = reasons.get(workout.key);
        if (workout.change === 'removed' && reason) {
          workout.reason = reason;
        }
      }
    }
  }

  protected ensureEditable(row: Workout, today: string): void {
    if (row.status !== 'planned' || this.isoOf(row.scheduledAt) < today) {
      throw new DomainConflictException('WORKOUT_LOCKED', 'Past and completed workouts cannot be edited');
    }
  }

  protected dateInPlan(context: ChangeContext, value: string | undefined): string {
    const date = parseIsoDate((value ?? '').slice(0, 10), 'PLAN_CHANGE_INVALID');
    if (date < context.today || date > context.planEnd) {
      throw this.invalid(`Date must be within ${context.today}..${context.planEnd}`);
    }
    return date;
  }

  protected validated(input: { type: string; distanceKm?: number; durationMinutes: number }): WorkoutView['type'] {
    const validation = this.engine.validateWorkoutOverride({
      type: input.type,
      ...(input.distanceKm !== undefined ? { distanceKm: input.distanceKm } : {}),
      durationMinutes: input.durationMinutes,
    });
    if (!validation.valid) {
      throw this.invalid(validation.reason);
    }
    return validation.value.type;
  }

  protected weekThreshold(week: RelativeWeek): number | null {
    for (const workout of week.workouts) {
      const estimate = this.engine.estimateThresholdFromTarget(workout.type, workout.target);
      if (estimate) {
        return estimate;
      }
    }
    return null;
  }

  protected weekNumberOfDate(context: ChangeContext, dateIso: string): number {
    const days = Math.floor(
      (new Date(`${dateIso}T00:00:00Z`).getTime() - new Date(`${context.planStart}T00:00:00Z`).getTime()) / 86_400_000,
    );
    return Math.max(1, Math.floor(days / 7) + 1);
  }

  /** Calendar date of a weekday within a plan week. */
  protected dayIso(context: ChangeContext, weekNumber: number, dayOfWeek: number): string {
    const startWeekday = mondayIndex(new Date(`${context.planStart}T00:00:00Z`));
    return addDaysIso(context.planStart, (weekNumber - 1) * 7 + ((dayOfWeek - startWeekday + 7) % 7));
  }

  protected findWeek(weeks: RelativeWeek[], weekNumber: number): RelativeWeek {
    const week = weeks.find((entry) => entry.weekNumber === weekNumber);
    if (!week) {
      throw this.invalid(`Week ${weekNumber} not found`);
    }
    return week;
  }

  protected locate(weeks: RelativeWeek[], key: string): { week: RelativeWeek; workout: RelativeWorkout } | null {
    for (const week of weeks) {
      const workout = week.workouts.find((entry) => entry.key === key);
      if (workout) {
        return { week, workout };
      }
    }
    return null;
  }

  protected clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  protected isoOf(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  protected maxIso(left: string, right: string): string {
    return left > right ? left : right;
  }

  protected invalid(message: string): DomainBadRequestException {
    return new DomainBadRequestException('PLAN_CHANGE_INVALID', message);
  }

  protected resizeImpossible(): DomainBadRequestException {
    return new DomainBadRequestException(
      'PLAN_RESIZE_NOT_POSSIBLE',
      'The plan cannot be resized to the requested date',
    );
  }
}
