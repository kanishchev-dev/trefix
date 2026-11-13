import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { GearDataSource, GearSource, GearType, WorkoutType } from '../training.constants';

/** Shoes, watches and sensors. Distance is computed from completed workouts, never stored. */
@Table({
  tableName: 'gear',
  underscored: true,
  paranoid: true,
})
export class Gear extends Model {
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
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: 'shoes',
  })
  type!: GearType;

  @Column({
    type: DataType.STRING(60),
    allowNull: false,
  })
  brand!: string;

  @Column({
    type: DataType.STRING(80),
    allowNull: false,
  })
  model!: string;

  @Column({
    type: DataType.STRING(60),
    allowNull: true,
  })
  nickname!: string | null;

  /** Distance covered before the pair was added to Trefix. */
  @Column({
    type: DataType.DECIMAL(7, 1),
    allowNull: false,
    defaultValue: 0,
    field: 'initial_distance_km',
    get(this: Gear): number {
      return Number(this.getDataValue('initialDistanceKm') ?? 0);
    },
  })
  initialDistanceKm!: number;

  /** Wear limit; only shoes have one. */
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'limit_km',
  })
  limitKm!: number | null;

  /** Shoes picked for new workouts when no workout-type default matches; one active pair at most. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_default' })
  isDefault!: boolean;

  /** The main recording device; its service wins when two services report the same run. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_primary' })
  isPrimary!: boolean;

  /** Service that delivers workouts recorded by this device. */
  @Column({ type: DataType.STRING(32), allowNull: true, field: 'data_source' })
  dataSource!: GearDataSource | null;

  /** ISO date `YYYY-MM-DD`. */
  @Column({
    type: DataType.DATEONLY,
    allowNull: true,
    field: 'started_at',
  })
  startedAt!: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'retired_at',
  })
  retiredAt!: Date | null;

  @Column({
    type: DataType.ARRAY(DataType.STRING(32)),
    allowNull: false,
    defaultValue: [],
    field: 'default_workout_types',
  })
  defaultWorkoutTypes!: WorkoutType[];

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'replace_reminder',
  })
  replaceReminder!: boolean;

  /** Set once the "replace soon" event fired for this pair. */
  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'replace_notified_at',
  })
  replaceNotifiedAt!: Date | null;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: 'manual',
  })
  source!: GearSource;

  @Column({
    type: DataType.STRING(64),
    allowNull: true,
    field: 'external_id',
  })
  externalId!: string | null;
}
