import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { ATHLETE_GOAL_DISTANCES, ATHLETE_GOAL_STATUSES } from '../training.constants';

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
    field: 'race_distance',
  })
  raceDistance!: (typeof ATHLETE_GOAL_DISTANCES)[number];

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'target_time_seconds',
  })
  targetTimeSeconds!: number | null;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    field: 'target_date',
  })
  targetDate!: string;

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
  status!: (typeof ATHLETE_GOAL_STATUSES)[number];

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  notes!: string | null;
}
