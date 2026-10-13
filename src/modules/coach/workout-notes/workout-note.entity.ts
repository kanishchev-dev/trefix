import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { type PreferenceLanguage } from '@/modules/users/users.constants';

/**
 * The coach's note to one workout in one language. `inputHash` fingerprints the
 * workout data the note was written from: when the workout changes, the note is
 * stale and is regenerated on the next request.
 */
@Table({
  tableName: 'coach_workout_notes',
  underscored: true,
  timestamps: true,
})
export class CoachWorkoutNote extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'workout_id' })
  workoutId!: string;

  @Column({ type: DataType.STRING(8), allowNull: false })
  language!: PreferenceLanguage;

  @Column({ type: DataType.STRING(64), allowNull: false, field: 'input_hash' })
  inputHash!: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  content!: string;

  @Column({ type: DataType.STRING, allowNull: false })
  model!: string;

  declare updatedAt: Date;
}
