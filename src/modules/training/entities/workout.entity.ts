import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { WORKOUT_STATUSES, WORKOUT_TYPES } from '../training.constants';

@Table({
  tableName: 'workouts',
  underscored: true,
  paranoid: true,
})
export class Workout extends Model {
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

  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'plan_id',
  })
  planId!: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'scheduled_at',
  })
  scheduledAt!: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'week_number',
  })
  weekNumber!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'type',
  })
  type!: (typeof WORKOUT_TYPES)[number];

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  phase!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: WORKOUT_STATUSES[0],
  })
  status!: (typeof WORKOUT_STATUSES)[number];

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'order_in_week',
  })
  orderInWeek!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'duration_minutes',
  })
  durationMinutes!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'distance_km',
  })
  distanceKm!: number;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: {},
  })
  target!: Record<string, unknown>;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
  })
  steps!: Array<Record<string, unknown>>;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  actual!: Record<string, unknown> | null;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  analysis!: Record<string, unknown> | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'completed_at',
  })
  completedAt!: Date | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'source_provider',
  })
  sourceProvider!: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'source_activity_id',
  })
  sourceActivityId!: string | null;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'gear_id',
  })
  gearId!: string | null;

  /** Watch or sensor the workout was recorded with. */
  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'device_id',
  })
  deviceId!: string | null;

  /** An erroneous track: kept in history but ignored by records and VDOT. */
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'exclude_from_records',
  })
  excludeFromRecords!: boolean;
}
