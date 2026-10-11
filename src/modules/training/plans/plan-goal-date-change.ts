import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';

import { PlanResizeNotPossibleError, RelativeWeek, RelativeWorkout } from '../training.engine';
import type { ChangeContext, ComputedPlanChange, PlanChangesInput, PlanMutation } from './plan-change.types';
import { PlanChangeSupport } from './plan-change-support';
import { addDaysIso, parseIsoDate } from './plan-utils';

/** Goal date change: shrinks or extends the remaining plan. */
export class GoalDateChange extends PlanChangeSupport {
  compute(context: ChangeContext, input: PlanChangesInput): ComputedPlanChange {
    const targetDate = parseIsoDate(input.goalTargetDate ?? '', 'PLAN_START_DATE_INVALID');
    if (targetDate < context.today) {
      throw new DomainBadRequestException('PLAN_START_DATE_INVALID', 'Goal date is in the past');
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
}
