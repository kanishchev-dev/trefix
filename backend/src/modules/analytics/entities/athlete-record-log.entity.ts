import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

/**
 * The moment an athlete set a personal record. Records are recomputed on the
 * fly in the app; the log keeps when they happened so they can be counted
 * across all athletes. Entries are never rewritten.
 */
@Table({ tableName: 'athlete_records_log', underscored: true, updatedAt: false })
export class AthleteRecordLog extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: () => uuidv7() })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'athlete_id' })
  athleteId!: string;

  @Column({ type: DataType.UUID, allowNull: true, field: 'workout_id' })
  workoutId!: string | null;

  @Column({ type: DataType.UUID, allowNull: true, field: 'race_result_id' })
  raceResultId!: string | null;

  @Column({ type: DataType.STRING(16), allowNull: false })
  distance!: string;

  @Column({ type: DataType.INTEGER, allowNull: false, field: 'time_seconds' })
  timeSeconds!: number;

  /** Best before this one; null for the first result on the distance. */
  @Column({ type: DataType.INTEGER, allowNull: true, field: 'previous_seconds' })
  previousSeconds!: number | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'achieved_at' })
  achievedAt!: Date;

  @Column({ type: DataType.DATE, field: 'created_at' })
  createdAt!: Date;
}
