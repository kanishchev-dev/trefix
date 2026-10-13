import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes } from 'sequelize';

import type { TrainingPlan } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';

export interface PlanStats {
  completedWorkouts: number;
  plannedWorkouts: number;
  completionRate: number;
  totalDistanceKm: number;
}

/** Snapshot of the plan in work shown in confirmations and the active endpoint. */
export interface ActivePlanSummary {
  id: string;
  name: string | null;
  startDate: string | null;
  endDate: string | null;
  currentWeek: number;
  totalWeeks: number;
  completedWorkouts: number;
  futurePlannedWorkouts: number;
}

interface StatsRow {
  plan_id: string;
  total: string | number;
  completed: string | number;
  planned: string | number;
  distance: string | number | null;
}

/**
 * Derived plan statistics, always recomputed from workouts so a late manual
 * completion immediately changes the completion rate. Read-only: plan status
 * transitions belong to PlanLifecycleService.
 */
@Injectable()
export class PlanStatsService {
  constructor(
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
  ) {}

  /** Stats of a single plan. */
  async computeStats(plan: TrainingPlan): Promise<PlanStats> {
    const stats = await this.computeStatsBatch([plan]);
    return stats.get(plan.id) ?? this.emptyStats();
  }

  /**
   * Stats of many plans in one grouped query. A workout counts only while
   * it is due: scheduled before the earliest of the plan end (inclusive),
   * cancellation time and now. Cancelled workouts never count.
   */
  async computeStatsBatch(plans: TrainingPlan[]): Promise<Map<string, PlanStats>> {
    const result = new Map<string, PlanStats>();
    const ids = plans.filter((plan) => plan.status !== 'draft').map((plan) => plan.id);
    if (ids.length === 0 || !this.workoutModel.sequelize) {
      return result;
    }

    const rows = await this.workoutModel.sequelize.query<StatsRow>(
      `SELECT w.plan_id,
              COUNT(*) AS total,
              COALESCE(SUM(CASE WHEN w.status = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
              COALESCE(SUM(CASE WHEN w.status = 'planned' THEN 1 ELSE 0 END), 0) AS planned,
              COALESCE(SUM(w.distance_km), 0) AS distance
         FROM workouts w
         JOIN training_plans p ON p.id = w.plan_id
        WHERE w.plan_id IN (:ids)
          AND w.deleted_at IS NULL
          AND w.status <> 'cancelled'
          AND w.scheduled_at < LEAST(
                COALESCE(p.end_date + INTERVAL '1 day', NOW()),
                COALESCE(p.cancelled_at, NOW()),
                NOW())
        GROUP BY w.plan_id`,
      { replacements: { ids }, type: QueryTypes.SELECT },
    );

    for (const row of rows) {
      const total = Number(row.total);
      const completed = Number(row.completed);
      result.set(row.plan_id, {
        completedWorkouts: completed,
        plannedWorkouts: Number(row.planned),
        completionRate: total > 0 ? Math.round((completed / total) * 100) / 100 : 0,
        totalDistanceKm: Math.round(Number(row.distance ?? 0) * 10) / 10,
      });
    }
    for (const id of ids) {
      if (!result.has(id)) {
        result.set(id, this.emptyStats());
      }
    }
    return result;
  }

  /** Current week number of a plan relative to today (0 when not started). */
  computeCurrentWeek(plan: TrainingPlan, todayIso: string): number {
    if (!plan.startDate || todayIso < plan.startDate) {
      return 0;
    }
    const days = Math.floor(
      (new Date(`${todayIso}T00:00:00Z`).getTime() - new Date(`${plan.startDate}T00:00:00Z`).getTime()) / 86_400_000,
    );
    const totalWeeks = plan.weeks.length || 1;
    return Math.max(1, Math.min(totalWeeks, Math.floor(days / 7) + 1));
  }

  /** Active plan summary used in start confirmations and the active endpoint. */
  async buildActivePlanSummary(plan: TrainingPlan, todayIso: string): Promise<ActivePlanSummary> {
    const [stats, future] = await Promise.all([
      this.computeStats(plan),
      this.workoutModel.count({
        where: { planId: plan.id, status: 'planned', scheduledAt: { [Op.gte]: new Date(`${todayIso}T00:00:00Z`) } },
      }),
    ]);

    return {
      id: plan.id,
      name: plan.name,
      startDate: plan.startDate,
      endDate: plan.endDate,
      currentWeek: this.computeCurrentWeek(plan, todayIso),
      totalWeeks: plan.weeks.length,
      completedWorkouts: stats.completedWorkouts,
      futurePlannedWorkouts: future,
    };
  }

  private emptyStats(): PlanStats {
    return { completedWorkouts: 0, plannedWorkouts: 0, completionRate: 0, totalDistanceKm: 0 };
  }
}
