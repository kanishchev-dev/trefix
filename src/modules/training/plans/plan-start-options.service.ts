import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';

import { DomainNotFoundException } from '@/common/exceptions/domain-exceptions';

import { TrainingPlan } from '../entities/training-plan.entity';
import { DRAFT_METRICS_STALE_DAYS } from '../training.constants';
import type { GoalSnapshot, StartOption, StartOptionKind, StartOptionsResult } from './plan-lifecycle.types';
import { PlanStatsService } from './plan-stats.service';
import { addDaysIso, mondayIndex, todayIsoInTz } from './plan-utils';

/** Start dates offered for a draft or a not yet saved plan preview. */
@Injectable()
export class PlanStartOptionsService {
  constructor(
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    private readonly statsService: PlanStatsService,
  ) {}

  /** Start options of a draft. */
  async getStartOptions(
    planId: string,
    timezone?: string | null,
    goalTargetDateOverride?: string | null,
  ): Promise<StartOptionsResult> {
    const plan = await this.planModel.findByPk(planId);
    if (!plan || plan.status !== 'draft') {
      throw new DomainNotFoundException('TRAINING_PLAN_NOT_FOUND', 'Training plan not found');
    }

    const goal = (plan.config?.goal ?? {}) as GoalSnapshot;
    return this.buildStartOptions({
      athleteId: plan.athleteId,
      totalWeeks: plan.weeks.length,
      targetDate: goalTargetDateOverride || goal.targetDate || null,
      timezone,
      metricsStale: this.isMetricsStale(plan),
    });
  }

  /**
   * Start options for any plan shape, including not yet saved previews.
   * "Race aligned" puts the race date into the last plan week: the plan
   * starts on the Monday of the race week minus `totalWeeks - 1` weeks.
   */
  async buildStartOptions(input: {
    athleteId: string;
    totalWeeks: number;
    targetDate?: string | null;
    timezone?: string | null;
    metricsStale?: boolean;
  }): Promise<StartOptionsResult> {
    const today = todayIsoInTz(input.timezone);
    const totalWeeks = Math.max(1, input.totalWeeks);
    const endOf = (startDate: string): string => addDaysIso(startDate, totalWeeks * 7 - 1);

    const nextMonday = this.nextMondayOrToday(today);
    const options: StartOption[] = [
      { kind: 'today', startDate: today, endDate: endOf(today) },
      { kind: 'next_monday', startDate: nextMonday, endDate: endOf(nextMonday) },
    ];
    let recommended: StartOptionKind = nextMonday === today ? 'today' : 'next_monday';

    const targetDate = input.targetDate ?? null;
    if (targetDate) {
      const alignedStart = addDaysIso(this.mondayOfWeek(targetDate), -(totalWeeks - 1) * 7);
      if (targetDate < today) {
        options.push({
          kind: 'race_aligned',
          startDate: alignedStart,
          endDate: endOf(alignedStart),
          goalTargetDate: targetDate,
          fits: false,
          reason: 'target_date_passed',
        });
      } else if (alignedStart >= today) {
        options.push({
          kind: 'race_aligned',
          startDate: alignedStart,
          endDate: endOf(alignedStart),
          goalTargetDate: targetDate,
          fits: true,
        });
        recommended = 'race_aligned';
      } else {
        options.push({
          kind: 'race_aligned',
          startDate: today,
          endDate: endOf(today),
          goalTargetDate: targetDate,
          fits: false,
          weeksAvailable: this.weeksBetween(today, targetDate),
        });
      }
    }

    const active = await this.planModel.findOne({ where: { athleteId: input.athleteId, status: 'active' } });
    return {
      today,
      totalWeeks,
      options,
      recommended,
      metricsStale: input.metricsStale ?? false,
      activePlan: active ? await this.statsService.buildActivePlanSummary(active, today) : null,
    };
  }

  /** Whether the draft metrics are older than the staleness window. */
  isMetricsStale(plan: TrainingPlan): boolean {
    const referenceIso = plan.metricsSnapshot?.capturedAt ?? plan.updatedAt.toISOString();
    const ageDays = (Date.now() - new Date(referenceIso).getTime()) / 86_400_000;
    return ageDays > DRAFT_METRICS_STALE_DAYS;
  }

  private mondayOfWeek(dateIso: string): string {
    return addDaysIso(dateIso, -mondayIndex(new Date(`${dateIso}T00:00:00Z`)));
  }

  private nextMondayOrToday(todayIso: string): string {
    const weekday = mondayIndex(new Date(`${todayIso}T00:00:00Z`));
    return weekday === 0 ? todayIso : addDaysIso(todayIso, 7 - weekday);
  }

  private weeksBetween(fromIso: string, toIso: string): number {
    const days = Math.floor(
      (new Date(`${toIso}T00:00:00Z`).getTime() - new Date(`${fromIso}T00:00:00Z`).getTime()) / 86_400_000,
    );
    return Math.max(0, Math.floor(days / 7) + 1);
  }
}
