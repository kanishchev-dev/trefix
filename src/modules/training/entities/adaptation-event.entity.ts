import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { AdaptationEventStatus } from '../training.constants';

@Table({
  tableName: 'adaptation_events',
  underscored: true,
  paranoid: true,
})
export class AdaptationEvent extends Model {
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
    field: 'plan_id',
  })
  planId!: string | null;

  @Column({
    type: DataType.UUID,
    allowNull: true,
    field: 'workout_id',
  })
  workoutId!: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  type!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: {},
  })
  input!: Record<string, unknown>;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: {},
  })
  decision!: Record<string, unknown>;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  reason!: string;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  confidence!: number;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: 'applied',
  })
  status!: AdaptationEventStatus;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'resolved_at',
  })
  resolvedAt!: Date | null;
}
