import { Column, DataType, Model, Table } from 'sequelize-typescript';

import type { GoalProgressStatus } from '@/modules/training/goals/goal-progress';

/** Progress of one goal as judged on one day by the nightly job. */
@Table({ tableName: 'goal_progress_snapshots', underscored: true, timestamps: false })
export class GoalProgressSnapshot extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, field: 'goal_id' })
  goalId!: string;

  @Column({ type: DataType.DATEONLY, primaryKey: true })
  date!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'athlete_id' })
  athleteId!: string;

  @Column({ type: DataType.STRING(24), allowNull: false })
  category!: string;

  @Column({ type: DataType.STRING(32), allowNull: false, field: 'goal_type' })
  goalType!: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  status!: GoalProgressStatus;

  @Column({ type: DataType.DECIMAL(5, 1), allowNull: true, field: 'progress_pct' })
  progressPct!: string | null;

  @Column({ type: DataType.DECIMAL, allowNull: true, field: 'current_value' })
  currentValue!: string | null;

  @Column({ type: DataType.DECIMAL, allowNull: true, field: 'target_value' })
  targetValue!: string | null;

  @Column({ type: DataType.DATEONLY, allowNull: true, field: 'target_date' })
  targetDate!: string | null;
}
