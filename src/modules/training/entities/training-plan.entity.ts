import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import {
  PLAN_CREATION_SOURCE_DEFAULT,
  PLAN_CREATION_SOURCES,
  TRAINING_LOAD_ALGORITHM_VERSION,
  TRAINING_PLAN_STATUSES,
} from '../training.constants';

/**
 * Plan configuration snapshot: the parameters the plan was
 * built from, kept in sync with schedule / goal-date edits of an active plan.
 */
export interface TrainingPlanConfig {
  goal: Record<string, unknown>;
  schedule: Record<string, unknown>;
  structure: Record<string, unknown>;
}

/**
 * Athlete metrics captured when the plan started. Used as
 * the "before" side of rebuild diffs and as the volume-scaling baseline.
 */
export interface TrainingPlanMetricsSnapshot {
  capturedAt: string;
  thresholdPaceSecondsPerKm?: number | null;
  thresholdHeartRate?: number | null;
  maxHeartRate?: number | null;
  restingHeartRate?: number | null;
  weeklyMileageKm?: number | null;
  longestRunKm?: number | null;
  recentResult?: { distance: string; timeSeconds: number; date: string } | null;
  source?: string;
}

/**
 * Athlete training plan with a full lifecycle:
 * draft → active → completed | cancelled.
 *
 * - `draft` has no dates and keeps a relative structure in `weeks`.
 * - `active` has dated weeks plus concrete rows in `workouts`.
 * - `completed` / `cancelled` are immutable history; reuse happens through
 *   rebuild into a new plan linked by `source_plan_id`.
 *
 * `version` enables Sequelize optimistic locking: every edit of an active plan
 * must pass the client-known `expectedVersion`.
 */
@Table({
  tableName: 'training_plans',
  underscored: true,
  paranoid: true,
  version: true,
})
export class TrainingPlan extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'athlete_id',
  })
  athleteId!: string;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'goal_id',
  })
  goalId!: string | null;

  /** Drafts have no dates; the CHECK constraint enforces dates for other statuses. */
  @Column({
    type: DataType.DATEONLY,
    allowNull: true,
    field: 'start_date',
  })
  startDate!: string | null;

  @Column({
    type: DataType.DATEONLY,
    allowNull: true,
    field: 'end_date',
  })
  endDate!: string | null;

  /** User-given name; null means the clients title the plan by its goal in the app language. */
  @Column({
    type: DataType.STRING(80),
    allowNull: true,
  })
  name!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  notes!: string | null;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
  })
  config!: TrainingPlanConfig;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'metrics_snapshot',
  })
  metricsSnapshot!: TrainingPlanMetricsSnapshot | null;

  /** Plan this one was rebuilt from ("prepare again"). */
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'source_plan_id',
  })
  sourcePlanId!: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'cancelled_at',
  })
  cancelledAt!: Date | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'cancel_reason',
  })
  cancelReason!: string | null;

  /** Plan that replaced this one when it was cancelled on another plan's start. */
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'replaced_by_plan_id',
  })
  replacedByPlanId!: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'training_frequency',
  })
  trainingFrequency!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'weekly_target_km',
  })
  weeklyTargetKm!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: TRAINING_PLAN_STATUSES[0],
  })
  status!: (typeof TRAINING_PLAN_STATUSES)[number];

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: PLAN_CREATION_SOURCE_DEFAULT,
  })
  creationSource!: (typeof PLAN_CREATION_SOURCES)[number];

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'algorithm_version',
    defaultValue: TRAINING_LOAD_ALGORITHM_VERSION,
  })
  algorithmVersion!: string;

  /**
   * Relative weeks for drafts, dated weeks with workout ids
   * for every other status.
   */
  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
  })
  weeks!: Array<Record<string, unknown>>;
}
