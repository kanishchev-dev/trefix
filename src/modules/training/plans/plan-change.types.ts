import type { TrainingPlan, TrainingPlanConfig } from '../entities/training-plan.entity';
import type { Workout } from '../entities/workout.entity';
import type { WorkoutView } from '../interfaces/training-views.interface';
import type { PlanDiff, RelativeWeek } from '../training.engine';

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

/** Shared input of every change kind. */
export interface ChangeContext {
  plan: TrainingPlan;
  planStart: string;
  planEnd: string;
  today: string;
  rows: Map<string, Workout>;
  threshold: number | null;
}
