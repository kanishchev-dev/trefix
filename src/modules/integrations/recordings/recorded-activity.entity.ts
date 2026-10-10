import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { DistanceSource, RecordingEnvironment } from '../constants/integrations.constants';
import type { RecordingOutcome } from './dto/recorded-activity.dto';

export interface RecordedSplit {
  km: number;
  durationSec: number;
  paceSecPerKm: number;
  elevationGainM: number | null;
  avgHeartRate: number | null;
  /** The last, shorter-than-a-kilometre piece. */
  partial: boolean;
}

export interface RecordedLap {
  index: number;
  kind: string;
  plannedSec: number | null;
  plannedM: number | null;
  actualSec: number;
  actualM: number;
  avgPaceSecPerKm: number | null;
  inTarget: boolean | null;
}

export interface RecordedPause {
  startedAt: string;
  endedAt: string;
  auto: boolean;
}

export interface RouteBounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

export interface RecordingDevice {
  platform: string;
  osVersion: string | null;
  appVersion: string | null;
  model: string | null;
}

/** A run recorded by the Trefix tracker; the workout it became is `workoutId`. */
@Table({ tableName: 'recorded_activities', underscored: true })
export class RecordedActivity extends Model {
  @Column({ type: DataType.UUID, defaultValue: () => uuidv7(), primaryKey: true })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'athlete_id' })
  athleteId!: string;

  @Column({ type: DataType.UUID, allowNull: true, field: 'workout_id' })
  workoutId!: string | null;

  /** How the record landed: a new workout, the planned one, merged into a watch record, a manual one. */
  @Column({ type: DataType.STRING(32), allowNull: true })
  outcome!: RecordingOutcome | null;

  @Column({ type: DataType.UUID, allowNull: false, field: 'client_session_id' })
  clientSessionId!: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  environment!: RecordingEnvironment;

  @Column({ type: DataType.STRING(16), allowNull: false, field: 'distance_source' })
  distanceSource!: DistanceSource;

  @Column({ type: DataType.UUID, allowNull: true, field: 'planned_workout_id' })
  plannedWorkoutId!: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'started_at' })
  startedAt!: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: 'ended_at' })
  endedAt!: Date;

  @Column({ type: DataType.SMALLINT, allowNull: true, field: 'utc_offset_minutes' })
  utcOffsetMinutes!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'elapsed_sec' })
  elapsedSec!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'moving_sec' })
  movingSec!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'distance_m' })
  distanceM!: number;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'measured_distance_m' })
  measuredDistanceM!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'elevation_gain_m' })
  elevationGainM!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'elevation_loss_m' })
  elevationLossM!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'avg_pace_sec_per_km' })
  avgPaceSecPerKm!: number | null;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'best_pace_sec_per_km' })
  bestPaceSecPerKm!: number | null;

  @Column({ type: DataType.SMALLINT, allowNull: true, field: 'avg_heart_rate' })
  avgHeartRate!: number | null;

  @Column({ type: DataType.SMALLINT, allowNull: true, field: 'max_heart_rate' })
  maxHeartRate!: number | null;

  @Column({ type: DataType.SMALLINT, allowNull: true, field: 'avg_cadence' })
  avgCadence!: number | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  splits!: RecordedSplit[];

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  laps!: RecordedLap[];

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: [] })
  pauses!: RecordedPause[];

  @Column({ type: DataType.TEXT, allowNull: true, field: 'route_line' })
  routeLine!: string | null;

  @Column({ type: DataType.JSONB, allowNull: true, field: 'route_bounds' })
  routeBounds!: RouteBounds | null;

  @Column({ type: DataType.JSONB, allowNull: true, field: 'start_point' })
  startPoint!: { lat: number; lng: number } | null;

  @Column({ type: DataType.UUID, allowNull: true, field: 'track_file_id' })
  trackFileId!: string | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  device!: RecordingDevice;

  @Column({ type: DataType.SMALLINT, allowNull: true })
  feeling!: number | null;

  @Column({ type: DataType.SMALLINT, allowNull: true })
  rpe!: number | null;

  @Column({ type: DataType.TEXT, allowNull: true })
  notes!: string | null;
}
