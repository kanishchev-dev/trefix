import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { RaceResultKind } from '../training.constants';

/** A result the athlete entered by hand: a race, a test or a workout without a track. */
@Table({
  tableName: 'race_results',
  underscored: true,
  paranoid: true,
})
export class RaceResult extends Model {
  @Column({ type: DataType.UUID, defaultValue: () => uuidv7(), primaryKey: true })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'athlete_id' })
  athleteId!: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'distance_m' })
  distanceM!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'time_seconds' })
  timeSeconds!: number;

  /** ISO date `YYYY-MM-DD`. */
  @Column({ type: DataType.DATEONLY, allowNull: false })
  date!: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  kind!: RaceResultKind;

  @Column({ type: DataType.STRING(120), allowNull: true })
  name!: string | null;
}
