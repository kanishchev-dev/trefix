import { Injectable } from '@nestjs/common';

import { DomainConflictException } from '@/common/exceptions/domain-exceptions';

import type { TrainingPlan } from '../entities/training-plan.entity';
import type { Workout } from '../entities/workout.entity';
import { TrainingEngine } from '../training.engine';
import type { ChangeContext, ComputedPlanChange, PlanChangesInput } from './plan-change.types';
import { GoalDateChange } from './plan-goal-date-change';
import { ScheduleChange } from './plan-schedule-change';
import { PlanStatsService } from './plan-stats.service';
import { todayIsoInTz } from './plan-utils';
import { WorkoutsChange } from './plan-workouts-change';

export type {
  ComputedPlanChange,
  PlanChangesInput,
  PlanMutation,
  PlanScheduleInput,
  WorkoutCreation,
  WorkoutOperation,
  WorkoutPatch,
} from './plan-change.types';

/**
 * Pure computation of active-plan changes. Preview and apply call the same
 * method on the same data, so what the user confirms is exactly what gets
 * persisted. Past, completed or otherwise non-planned workouts are locked:
 * they are history and never move, change or disappear.
 */
@Injectable()
export class PlanChangeCalculator {
  private readonly workouts: WorkoutsChange;
  private readonly schedule: ScheduleChange;
  private readonly goalDate: GoalDateChange;

  constructor(engine: TrainingEngine, statsService: PlanStatsService) {
    this.workouts = new WorkoutsChange(engine, statsService);
    this.schedule = new ScheduleChange(engine, statsService);
    this.goalDate = new GoalDateChange(engine, statsService);
  }

  compute(plan: TrainingPlan, workouts: Workout[], input: PlanChangesInput): ComputedPlanChange {
    if (!plan.startDate || !plan.endDate) {
      throw new DomainConflictException('PLAN_INVALID_STATUS', 'The plan has no dates');
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
      return this.workouts.compute(context, input.operations ?? []);
    }
    if (input.kind === 'schedule') {
      return this.schedule.compute(context, input);
    }
    return this.goalDate.compute(context, input);
  }
}
