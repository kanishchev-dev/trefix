import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, literal, Op, OrderItem, WhereOptions } from 'sequelize';

import { TrainingPlan, TrainingPlanConfig, TrainingPlanMetricsSnapshot } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import type { GoalView } from '../interfaces/training-views.interface';
import type { PlanListGroup, TrainingPlanStatus } from '../training.constants';
import { PlanEditingService } from './plan-editing.service';
import { PlanLifecycleService } from './plan-lifecycle.service';
import { PlanStartOptionsService } from './plan-start-options.service';
import { ActivePlanSummary, PlanStats, PlanStatsService } from './plan-stats.service';
import { resolveGoalSummaryTitle, todayIsoInTz } from './plan-utils';

export interface PlanGoalSummary {
  type: string | null;
  title: string | null;
  targetDate: string | null;
}

export interface PlanListItem {
  id: string;
  name: string;
  status: TrainingPlanStatus;
  creationSource: string;
  goal: PlanGoalSummary;
  totalWeeks: number;
  sessionsPerWeek: number | null;
  startDate: string | null;
  endDate: string | null;
  cancelledAt: string | null;
  stats: PlanStats | null;
  notesPreview: string | null;
  sourcePlanId: string | null;
  metricsStale?: boolean;
  currentWeek?: number;
  progress?: number;
  updatedAt: string;
}

export interface PlanListResult {
  items: PlanListItem[];
  meta: { page: number; limit: number; total: number; hasNext: boolean };
}

export interface PlanWorkoutItem {
  id: string;
  weekNumber: number;
  orderInWeek: number;
  scheduledAt: string;
  type: string;
  status: string;
  durationMinutes: number;
  distanceKm: number;
  target: Record<string, unknown>;
  actual: Record<string, unknown> | null;
}

export interface PlanDetails extends Omit<PlanListItem, 'notesPreview'> {
  cancelReason: string | null;
  notes: string | null;
  version: number;
  config: TrainingPlanConfig;
  metricsSnapshot: TrainingPlanMetricsSnapshot | null;
  replacedByPlanId: string | null;
  weeks: Array<Record<string, unknown>>;
  /** Dated plans only: planned and actual workouts, cancelled ones excluded. */
  workouts: PlanWorkoutItem[];
}

const NOTES_PREVIEW_LENGTH = 160;

/** Read side of the plans library: grouped lists, badges, active summary and details. */
@Injectable()
export class PlanListService {
  constructor(
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly editingService: PlanEditingService,
    private readonly lifecycleService: PlanLifecycleService,
    private readonly startOptions: PlanStartOptionsService,
    private readonly statsService: PlanStatsService,
  ) {}

  /** Paginated list of one group; stats are aggregated in a single query. */
  async list(actorUserId: string, group: PlanListGroup, page: number, limit: number): Promise<PlanListResult> {
    const athlete = await this.editingService.loadAthleteByUserId(actorUserId);
    if (!athlete) {
      return { items: [], meta: { page, limit, total: 0, hasNext: false } };
    }

    const statusWhere: WhereOptions =
      group === 'history' ? { status: { [Op.in]: ['completed', 'cancelled'] } } : { status: group };
    const order: OrderItem[] =
      group === 'history' ? [[literal('COALESCE(cancelled_at, end_date)'), 'DESC']] : [['updatedAt', 'DESC']];

    const { rows, count } = await this.planModel.findAndCountAll({
      where: { athleteId: athlete.id, ...statusWhere },
      order,
      offset: (page - 1) * limit,
      limit,
    });

    for (const plan of rows) {
      await this.lifecycleService.completeIfEnded(plan);
    }
    // A plan completed by the lazy check above no longer belongs to the active group.
    const visible = group === 'active' ? rows.filter((plan) => plan.status === 'active') : rows;
    const stats = await this.statsService.computeStatsBatch(visible);
    const today = todayIsoInTz('UTC');

    return {
      items: visible.map((plan) => ({
        ...this.toSummary(plan, stats.get(plan.id) ?? null, today),
        notesPreview: plan.notes ? plan.notes.slice(0, NOTES_PREVIEW_LENGTH) : null,
      })),
      meta: { page, limit, total: count, hasNext: page * limit < count },
    };
  }

  /** Badge counts per group. */
  async counts(actorUserId: string): Promise<Record<PlanListGroup, number>> {
    const result: Record<PlanListGroup, number> = { draft: 0, active: 0, history: 0 };
    const athlete = await this.editingService.loadAthleteByUserId(actorUserId);
    if (!athlete) {
      return result;
    }

    const rows = (await this.planModel.findAll({
      where: { athleteId: athlete.id },
      attributes: ['status', [fn('COUNT', col('id')), 'count']],
      group: ['status'],
      raw: true,
    })) as unknown as Array<{ status: TrainingPlanStatus; count: string }>;

    for (const row of rows) {
      const count = Number(row.count);
      if (row.status === 'draft') {
        result.draft += count;
      } else if (row.status === 'active') {
        result.active += count;
      } else if (row.status === 'completed' || row.status === 'cancelled') {
        result.history += count;
      }
    }
    return result;
  }

  /** Active plan summary; `null` when there is none. */
  async getActive(actorUserId: string, timezone?: string | null): Promise<ActivePlanSummary | null> {
    const athlete = await this.editingService.loadAthleteByUserId(actorUserId);
    if (!athlete) {
      return null;
    }

    const active = await this.planModel.findOne({ where: { athleteId: athlete.id, status: 'active' } });
    if (!active) {
      return null;
    }

    await this.lifecycleService.completeIfEnded(active);
    if (active.status !== 'active') {
      return null;
    }
    return this.statsService.buildActivePlanSummary(active, todayIsoInTz(timezone));
  }

  /** Full plan details. */
  async getDetails(planId: string, actorUserId: string): Promise<PlanDetails> {
    const plan = await this.editingService.loadOwnedPlan(planId, actorUserId);
    await this.lifecycleService.completeIfEnded(plan);

    const stats = plan.status === 'draft' ? null : await this.statsService.computeStats(plan);
    const workouts =
      plan.status === 'draft'
        ? []
        : await this.workoutModel.findAll({
            where: { planId: plan.id, status: { [Op.ne]: 'cancelled' } },
            order: [
              ['weekNumber', 'ASC'],
              ['scheduledAt', 'ASC'],
              ['orderInWeek', 'ASC'],
            ],
          });

    return {
      ...this.toSummary(plan, stats, todayIsoInTz('UTC')),
      cancelReason: plan.cancelReason,
      notes: plan.notes,
      version: plan.version,
      config: plan.config,
      metricsSnapshot: plan.metricsSnapshot,
      replacedByPlanId: plan.replacedByPlanId,
      weeks: plan.weeks,
      workouts: workouts.map((workout) => ({
        id: workout.id,
        weekNumber: workout.weekNumber,
        orderInWeek: workout.orderInWeek,
        scheduledAt: workout.scheduledAt.toISOString(),
        type: workout.type,
        status: workout.status,
        durationMinutes: workout.durationMinutes,
        distanceKm: workout.distanceKm,
        target: (workout.target as Record<string, unknown>) ?? {},
        actual: (workout.actual as Record<string, unknown> | null) ?? null,
      })),
    };
  }

  // ------------------------------------------------------------------ helpers

  private toSummary(plan: TrainingPlan, stats: PlanStats | null, today: string): Omit<PlanListItem, 'notesPreview'> {
    const goalView = this.goalViewFromConfig(plan);
    const isActive = plan.status === 'active';
    const currentWeek = isActive ? this.statsService.computeCurrentWeek(plan, today) : undefined;

    return {
      id: plan.id,
      name: plan.name,
      status: plan.status,
      creationSource: plan.creationSource,
      goal: {
        type: goalView?.type ?? null,
        title: goalView ? resolveGoalSummaryTitle(goalView) : null,
        targetDate: goalView?.targetDate ?? null,
      },
      totalWeeks: plan.weeks.length,
      sessionsPerWeek: (plan.config?.structure as { sessionsPerWeek?: number } | undefined)?.sessionsPerWeek ?? null,
      startDate: plan.startDate,
      endDate: plan.endDate,
      cancelledAt: plan.cancelledAt ? plan.cancelledAt.toISOString() : null,
      stats,
      sourcePlanId: plan.sourcePlanId,
      metricsStale: plan.status === 'draft' ? this.startOptions.isMetricsStale(plan) : undefined,
      currentWeek,
      progress: currentWeek !== undefined && plan.weeks.length > 0 ? currentWeek / plan.weeks.length : undefined,
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  private goalViewFromConfig(plan: TrainingPlan): GoalView | null {
    const goal = plan.config?.goal as Record<string, unknown> | undefined;
    if (!goal || !goal.type) {
      return null;
    }

    const target = (goal.target ?? {}) as Record<string, unknown>;
    return {
      id: plan.goalId ?? plan.id,
      athleteId: plan.athleteId,
      type: String(goal.type),
      payload: {
        current: (goal.current ?? undefined) as Record<string, unknown> | undefined,
        target,
        description: (goal.description ?? undefined) as string | undefined,
      },
      raceDistance: 'legacy',
      targetTimeSeconds: typeof target.finishTimeSec === 'number' ? target.finishTimeSec : null,
      targetDate: (goal.targetDate as string | null) ?? null,
      priority: Number(goal.priority ?? 5),
      status: 'active',
      notes: null,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
