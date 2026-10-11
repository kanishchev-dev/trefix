import type { TrainingPlanConfig, TrainingPlanMetricsSnapshot } from '../entities/training-plan.entity';
import type { PlanCreationSource } from '../training.constants';
import type { RelativeWeek } from '../training.engine';
import type { ActivePlanSummary } from './plan-stats.service';

export interface PlanStartInput {
  startDate: string;
  goalTargetDate?: string | null;
  replaceActive: boolean;
  timezone?: string | null;
}

export interface PlanStartBehavior {
  /** Metrics to snapshot at start; defaults to the plan's own snapshot or a fresh estimate. */
  metrics?: TrainingPlanMetricsSnapshot | null;
  /** Reuse an existing goal (engine-generated plans) instead of creating one from the config. */
  existingGoalId?: string | null;
  /** Legacy clients may send yesterday's date across timezones; the date is clamped instead of rejected. */
  clampPastStartDate?: boolean;
}

export interface CreatePlanInput {
  athleteId: string;
  name: string;
  notes?: string | null;
  config: TrainingPlanConfig;
  creationSource: PlanCreationSource;
  trainingFrequency: number;
  weeklyTargetKm: number;
  weeks: RelativeWeek[];
  metricsSnapshot: TrainingPlanMetricsSnapshot | null;
  sourcePlanId?: string | null;
}

export type StartOptionKind = 'today' | 'next_monday' | 'race_aligned';

export interface StartOption {
  kind: StartOptionKind;
  startDate: string;
  endDate: string;
  goalTargetDate?: string;
  fits?: boolean;
  weeksAvailable?: number;
  reason?: 'target_date_passed';
}

export interface StartOptionsResult {
  today: string;
  totalWeeks: number;
  options: StartOption[];
  recommended: StartOptionKind;
  metricsStale: boolean;
  activePlan: ActivePlanSummary | null;
}

export interface GoalSnapshot {
  type?: string;
  current?: Record<string, unknown> | null;
  target?: Record<string, unknown> | null;
  description?: string | null;
  targetDate?: string | null;
  priority?: number;
}
