import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { TRAINING_STATE_SOURCE } from '../training.constants';

@Table({
  tableName: 'athlete_states',
  underscored: true,
  timestamps: true,
  createdAt: true,
  updatedAt: 'updated_at',
  paranoid: false,
})
export class AthleteState extends Model {
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
    type: DataType.FLOAT,
    allowNull: false,
  })
  fitness!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  fatigue!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  form!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
    field: 'threshold_pace_seconds_per_km',
  })
  thresholdPaceSecondsPerKm!: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'threshold_heart_rate',
  })
  thresholdHeartRate!: number | null;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
  })
  vo2max!: number | null;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'weekly_load',
  })
  weeklyLoad!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'acute_load',
  })
  acuteLoad!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'chronic_load',
  })
  chronicLoad!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
    field: 'recovery_score',
  })
  recoveryScore!: number | null;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  confidence!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: TRAINING_STATE_SOURCE,
  })
  source!: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'updated_at',
  })
  updatedAt!: Date;
}
