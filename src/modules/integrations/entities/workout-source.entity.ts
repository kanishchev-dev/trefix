import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { ActivitySource, RunningActivityType } from '../interfaces/running-activity.interface';

/** Normalized facts of one source record; identifiers live in columns. */
export interface WorkoutSourceFacts {
  type: RunningActivityType;
  movingTimeSec: number | null;
  elapsedTimeSec: number | null;
  elevationGainMeters: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  cadence: number | null;
  calories: number | null;
  gearExternalId: string | null;
}

/** Links a workout to the provider records it was built from; exactly one link per workout is primary. */
@Table({
  tableName: 'workout_sources',
  underscored: true,
  paranoid: true,
})
export class WorkoutSource extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'workout_id' })
  workoutId!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'athlete_id' })
  athleteId!: string;

  @Column({ type: DataType.STRING(32), allowNull: false })
  provider!: ActivitySource;

  @Column({ type: DataType.STRING(128), allowNull: false, field: 'source_activity_id' })
  sourceActivityId!: string;

  @Column({ type: DataType.STRING(255), allowNull: true, field: 'origin_app_id' })
  originAppId!: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true, field: 'origin_device' })
  originDevice!: string | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_primary' })
  isPrimary!: boolean;

  @Column({ type: DataType.DATE, allowNull: false, field: 'started_at' })
  startedAt!: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: 'ended_at' })
  endedAt!: Date;

  @Column({ type: DataType.SMALLINT, allowNull: true, field: 'utc_offset_minutes' })
  utcOffsetMinutes!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'duration_sec' })
  durationSec!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'distance_meters' })
  distanceMeters!: number;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  facts!: WorkoutSourceFacts;
}
