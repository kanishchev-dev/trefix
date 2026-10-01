import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { ATHLETE_GOAL_STATUSES, AthleteGoalStatus } from '../training.constants';

/**
 * Canonical athlete goal (PRD section 9).
 *
 * The row is polymorphic: `type` discriminates the payload stored in the
 * `payload` JSONB column ({ current?, target?, description? }). Legacy
 * race-oriented columns (race_distance / target_time_seconds / target_date)
 * are kept in sync for existing consumers; new goal types derive them.
 */
@Table({
  tableName: 'athlete_goals',
  underscored: true,
  paranoid: true,
})
export class AthleteGoal extends Model {
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
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'prepare_for_race',
  })
  type!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  payload!: {
    current?: Record<string, unknown>;
    target?: Record<string, unknown>;
    description?: string;
  } | null;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'race_distance',
  })
  raceDistance!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'target_time_seconds',
  })
  targetTimeSeconds!: number | null;

  @Column({
    type: DataType.DATEONLY,
    allowNull: true,
    field: 'target_date',
  })
  targetDate!: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 5,
  })
  priority!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: ATHLETE_GOAL_STATUSES[0],
  })
  status!: AthleteGoalStatus;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  notes!: string | null;
}
