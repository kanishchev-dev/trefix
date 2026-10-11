import { HttpStatus, Injectable } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

import type { TrainingPlan, TrainingPlanConfig } from '../entities/training-plan.entity';
import type { Workout } from '../entities/workout.entity';
import type { WorkoutView } from '../interfaces/training-views.interface';
import {
  PlanDiff,
  PlanResizeNotPossibleError,
  RelativeWeek,
  RelativeWorkout,
  TrainingEngine,
} from '../training.engine';
import { PlanStatsService } from './plan-stats.service';
import { addDaysIso, mondayIndex, parseIsoDate, todayIsoInTz } from './plan-utils';

/** `workouts` change operation. */
export interface WorkoutOperation {
  op: 'update' | 'move' | 'remove' | 'add';
  workoutId?: string;
  date?: string;
  type?: string;
  distanceKm?: number;
  durationMinutes?: number;
}

export interface PlanScheduleInput {
  trainingDays: number[];
  preferredLongRunDay?: number | null;
  workoutDurationMinutes?: number | null;
}

export interface PlanChangesInput {
  kind: 'workouts' | 'schedule' | 'goal_date';
  expectedVersion: number;
  timezone?: string | null;
  operations?: WorkoutOperation[];
  schedule?: PlanScheduleInput;
  effectiveFrom?: 'next_week' | 'tomorrow';
  goalTargetDate?: string;
}

/** Field values written onto an existing workout row. */
export interface WorkoutPatch {
  scheduledAt?: Date;
  weekNumber?: number;
  orderInWeek?: number;
  type?: WorkoutView['type'];
  durationMinutes?: number;
  distanceKm?: number;
  target?: Record<string, unknown>;
  steps?: Array<Record<string, unknown>>;
}

/** A workout row to insert. */
export interface WorkoutCreation {
  weekNumber: number;
  scheduledAt: Date;
  orderInWeek: number;
  type: WorkoutView['type'];
  phase: string;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  steps: Array<Record<string, unknown>>;
}

/** Everything an apply has to persist; computed identically for preview and apply. */
export interface PlanMutation {
  removals: string[];
  updates: Array<{ id: string; patch: WorkoutPatch }>;
  creations: WorkoutCreation[];
  /** Replacement week metadata when the number of weeks changes. */
  weeks?: RelativeWeek[];
  endDate?: string;
  config?: TrainingPlanConfig;
  goalTargetDate?: string;
  /** New athlete availability, kept in sync with a schedule change. */
  athleteSchedule?: PlanScheduleInput;
}

export interface ComputedPlanChange {
  diff: PlanDiff;
  warnings: string[];
  resultingEndDate: string | null;
  mutation: PlanMutation;
}

/**
 * Pure computation of active-plan changes. Preview and apply call the same
 * method on the same data, so what the user confirms is exactly what gets
 * persisted. Past, completed or otherwise non-planned workouts are locked:
 * they are history and never move, change or disappear.
 */
@Injectable()
export class PlanChangeCalculator {
  constructor(
    private readonly engine: TrainingEngine,
    private readonly statsService: PlanStatsService,
  ) {}

  compute(plan: TrainingPlan, workouts: Workout[], input: PlanChangesInput): ComputedPlanChange {
    if (!plan.startDate || !plan.endDate) {
      throw new DomainException('PLAN_INVALID_STATUS', 'The plan has no dates', HttpStatus.CONFLICT);
    }
    const context: ChangeContext = {
      plan,
      planStart: plan.startDate,
      planEnd: plan.endDate,
      today: todayIsoInTz(input.timezone),
      rows: new Map(workouts.filter((workout) => workout.status !== 'cancelled').map((row) => [row.id, row])),
      threshold: plan.metricsSnapshot?.thresholdPaceSecondsPerKm ?? null,
    };

    if (input.kind === 'workouts') {
      return this.computeWorkouts(context, input.operations ?? []);
    }
    if (input.kind === 'schedule') {
      return this.computeSchedule(context, input);
    }
    return this.computeGoalDate(context, input);
  }

  // ---------------------------------------------------------------- workouts

  private computeWorkouts(context: ChangeContext, operations: WorkoutOperation[]): ComputedPlanChange {
    if (operations.length === 0) {
      throw this.invalid('At least one operation is required');
    }

    const before = this.project(context);
    const after = this.clone(before);
    const mutation: PlanMutation = { removals: [], updates: [], creations: [] };
    const patches = new Map<string, WorkoutPatch>();
    const created = new Map<string, WorkoutCreation>();
    const touchedWeeks = new Set<number>();

    operations.forEach((operation, index) => {
      if (operation.op === 'add') {
        const date = this.dateInPlan(context, operation.date);
        const weekNumber = this.weekNumberOfDate(context, date);
        const week = this.findWeek(after, weekNumber);
        const type = this.validated({
          type: operation.type ?? 'easy',
          distanceKm: operation.distanceKm,
          durationMinutes: operation.durationMinutes ?? 30,
        });
        const durationMinutes = operation.durationMinutes ?? 30;
        const rebuilt = this.engine.rebuildWorkoutTarget({
          type,
          durationMinutes,
          thresholdPaceSecondsPerKm: context.threshold ?? this.weekThreshold(week),
        });
        const key = `new-${index + 1}`;
        touchedWeeks.add(weekNumber);
        week.workouts.push({
          key,
          dayOfWeek: mondayIndex(new Date(`${date}T00:00:00Z`)),
          orderInWeek: week.workouts.length + 1,
          type,
          phase: week.phase,
          durationMinutes,
          distanceKm: operation.distanceKm ?? 0,
          target: rebuilt.target,
          steps: rebuilt.steps,
        });
        created.set(key, {
          weekNumber,
          scheduledAt: new Date(`${date}T00:00:00Z`),
          orderInWeek: 0,
          type,
          phase: week.phase,
          durationMinutes,
          distanceKm: operation.distanceKm ?? 0,
          target: rebuilt.target,
          steps: rebuilt.steps,
        });
        return;
      }

      const row = operation.workoutId ? context.rows.get(operation.workoutId) : undefined;
      if (!row) {
        throw this.invalid('Workout not found in this plan');
      }
      this.ensureEditable(row, context.today);
      const location = this.locate(after, row.id);
      if (!location) {
        throw this.invalid('Workout not found in this plan');
      }
      const patch = patches.get(row.id) ?? {};
      touchedWeeks.add(location.week.weekNumber);

      if (operation.op === 'remove') {
        location.week.workouts = location.week.workouts.filter((workout) => workout.key !== row.id);
        mutation.removals.push(row.id);
        patches.delete(row.id);
        return;
      }

      if (operation.op === 'move') {
        const date = this.dateInPlan(context, operation.date);
        const weekNumber = this.weekNumberOfDate(context, date);
        const target = this.findWeek(after, weekNumber);
        touchedWeeks.add(weekNumber);
        location.week.workouts = location.week.workouts.filter((workout) => workout.key !== row.id);
        location.workout.dayOfWeek = mondayIndex(new Date(`${date}T00:00:00Z`));
        target.workouts.push(location.workout);
        patch.scheduledAt = new Date(`${date}T00:00:00Z`);
        patch.weekNumber = weekNumber;
      }

      if (operation.op === 'update') {
        const workout = location.workout;
        const type = this.validated({
          type: operation.type ?? workout.type,
          distanceKm: operation.distanceKm,
          durationMinutes: operation.durationMinutes ?? workout.durationMinutes,
        });
        const previousType = workout.type;
        workout.type = type;
        workout.durationMinutes = operation.durationMinutes ?? workout.durationMinutes;
        workout.distanceKm = operation.distanceKm ?? workout.distanceKm;
        const rebuilt = this.engine.rebuildWorkoutTarget({
          type,
          durationMinutes: workout.durationMinutes,
          previousType,
          previousTarget: workout.target,
          thresholdPaceSecondsPerKm: context.threshold,
        });
        workout.target = rebuilt.target;
        workout.steps = rebuilt.steps;
        Object.assign(patch, {
          type,
          durationMinutes: workout.durationMinutes,
          distanceKm: workout.distanceKm,
          target: rebuilt.target,
          steps: rebuilt.steps,
        });
      }

      patches.set(row.id, patch);
    });

    this.reorder(after, context, patches, created, touchedWeeks);
    mutation.updates = [...patches.entries()]
      .filter(([, patch]) => Object.keys(patch).length > 0)
      .map(([id, patch]) => ({ id, patch }));
    mutation.creations = [...created.values()];

    return {
      diff: this.engine.diffPlans(before, after),
      warnings: [],
      resultingEndDate: context.planEnd,
      mutation,
    };
  }

  // ---------------------------------------------------------------- schedule

  private computeSchedule(context: ChangeContext, input: PlanChangesInput): ComputedPlanChange {
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

  // --------------------------------------------------------------- goal date

  private computeGoalDate(context: ChangeContext, input: PlanChangesInput): ComputedPlanChange {
    const targetDate = parseIsoDate(input.goalTargetDate ?? '', 'PLAN_START_DATE_INVALID');
    if (targetDate < context.today) {
      throw new DomainException('PLAN_START_DATE_INVALID', 'Goal date is in the past', HttpStatus.BAD_REQUEST);
    }

    // Started weeks (including the current one) are never resized.
    const keepWeeks = this.statsService.computeCurrentWeek(context.plan, context.today);
    const days = Math.floor(
      (new Date(`${targetDate}T00:00:00Z`).getTime() - new Date(`${context.planStart}T00:00:00Z`).getTime()) /
        86_400_000,
    );
    const newTotal = Math.floor(days / 7) + 1;
    if (newTotal <= keepWeeks) {
      throw this.resizeImpossible();
    }

    const before = this.project(context);
    const lockedFuture = new Map<number, RelativeWorkout[]>();
    const resizeInput = before.map((week) => {
      if (week.weekNumber <= keepWeeks) {
        return week;
      }
      const planned = week.workouts.filter((workout) => context.rows.get(workout.key)?.status === 'planned');
      const locked = week.workouts.filter((workout) => !planned.includes(workout));
      if (locked.length > 0) {
        lockedFuture.set(week.weekNumber, locked);
      }
      return { ...week, workouts: planned };
    });

    let resized: RelativeWeek[];
    try {
      resized = this.engine.resizeToTargetDate(resizeInput, keepWeeks + 1, newTotal);
    } catch (error) {
      if (error instanceof PlanResizeNotPossibleError) {
        throw this.resizeImpossible();
      }
      throw error;
    }

    // Locked sessions of future weeks (e.g. done ahead of time) stay where they are.
    const after = this.clone(resized);
    for (const [weekNumber, locked] of lockedFuture) {
      const week = after.find((entry) => entry.weekNumber === weekNumber);
      if (week) {
        week.workouts.push(...locked);
      }
    }

    const mutation: PlanMutation = { removals: [], updates: [], creations: [] };
    const keptKeys = new Set<string>();
    for (const week of resized) {
      if (week.weekNumber <= keepWeeks) {
        continue;
      }
      week.workouts.forEach((workout, index) => {
        const scheduledAt = new Date(`${this.dayIso(context, week.weekNumber, workout.dayOfWeek)}T00:00:00Z`);
        if (context.rows.has(workout.key)) {
          keptKeys.add(workout.key);
          mutation.updates.push({
            id: workout.key,
            patch: { scheduledAt, weekNumber: week.weekNumber, orderInWeek: index + 1 },
          });
        } else {
          mutation.creations.push({
            weekNumber: week.weekNumber,
            scheduledAt,
            orderInWeek: index + 1,
            type: workout.type,
            phase: week.phase,
            durationMinutes: workout.durationMinutes,
            distanceKm: workout.distanceKm,
            target: workout.target,
            steps: workout.steps,
          });
        }
      });
    }
    for (const week of resizeInput) {
      if (week.weekNumber > keepWeeks) {
        mutation.removals.push(...week.workouts.map((workout) => workout.key).filter((key) => !keptKeys.has(key)));
      }
    }

    const endDate = addDaysIso(context.planStart, newTotal * 7 - 1);
    const config = context.plan.config;
    mutation.weeks = resized;
    mutation.endDate = endDate;
    mutation.goalTargetDate = targetDate;
    mutation.config = {
      ...config,
      goal: { ...config.goal, targetDate },
      structure: { ...config.structure, totalWeeks: newTotal },
    };

    return { diff: this.engine.diffPlans(before, after), warnings: [], resultingEndDate: endDate, mutation };
  }

  // ----------------------------------------------------------------- helpers

  /** Relative projection of the active plan keyed by workout id. */
  private project(context: ChangeContext): RelativeWeek[] {
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
  private reorder(
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

  private annotateRemovals(diff: PlanDiff, removed: Array<{ key: string; reason: string }>): void {
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

  private ensureEditable(row: Workout, today: string): void {
    if (row.status !== 'planned' || this.isoOf(row.scheduledAt) < today) {
      throw new DomainException('WORKOUT_LOCKED', 'Past and completed workouts cannot be edited', HttpStatus.CONFLICT);
    }
  }

  private dateInPlan(context: ChangeContext, value: string | undefined): string {
    const date = parseIsoDate((value ?? '').slice(0, 10), 'PLAN_CHANGE_INVALID');
    if (date < context.today || date > context.planEnd) {
      throw this.invalid(`Date must be within ${context.today}..${context.planEnd}`);
    }
    return date;
  }

  private validated(input: { type: string; distanceKm?: number; durationMinutes: number }): WorkoutView['type'] {
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

  private weekThreshold(week: RelativeWeek): number | null {
    for (const workout of week.workouts) {
      const estimate = this.engine.estimateThresholdFromTarget(workout.type, workout.target);
      if (estimate) {
        return estimate;
      }
    }
    return null;
  }

  private weekNumberOfDate(context: ChangeContext, dateIso: string): number {
    const days = Math.floor(
      (new Date(`${dateIso}T00:00:00Z`).getTime() - new Date(`${context.planStart}T00:00:00Z`).getTime()) / 86_400_000,
    );
    return Math.max(1, Math.floor(days / 7) + 1);
  }

  /** Calendar date of a weekday within a plan week. */
  private dayIso(context: ChangeContext, weekNumber: number, dayOfWeek: number): string {
    const startWeekday = mondayIndex(new Date(`${context.planStart}T00:00:00Z`));
    return addDaysIso(context.planStart, (weekNumber - 1) * 7 + ((dayOfWeek - startWeekday + 7) % 7));
  }

  private findWeek(weeks: RelativeWeek[], weekNumber: number): RelativeWeek {
    const week = weeks.find((entry) => entry.weekNumber === weekNumber);
    if (!week) {
      throw this.invalid(`Week ${weekNumber} not found`);
    }
    return week;
  }

  private locate(weeks: RelativeWeek[], key: string): { week: RelativeWeek; workout: RelativeWorkout } | null {
    for (const week of weeks) {
      const workout = week.workouts.find((entry) => entry.key === key);
      if (workout) {
        return { week, workout };
      }
    }
    return null;
  }

  private clone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value)) as T;
  }

  private isoOf(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private maxIso(left: string, right: string): string {
    return left > right ? left : right;
  }

  private invalid(message: string): DomainException {
    return new DomainException('PLAN_CHANGE_INVALID', message, HttpStatus.BAD_REQUEST);
  }

  private resizeImpossible(): DomainException {
    return new DomainException(
      'PLAN_RESIZE_NOT_POSSIBLE',
      'The plan cannot be resized to the requested date',
      HttpStatus.BAD_REQUEST,
    );
  }
}

interface ChangeContext {
  plan: TrainingPlan;
  planStart: string;
  planEnd: string;
  today: string;
  rows: Map<string, Workout>;
  threshold: number | null;
}
