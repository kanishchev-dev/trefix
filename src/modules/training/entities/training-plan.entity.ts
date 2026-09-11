import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { TRAINING_LOAD_ALGORITHM_VERSION, TRAINING_PLAN_STATUSES } from '../training.constants';

@Table({
  tableName: 'training_plans',
  underscored: true,
  paranoid: true,
})
export class TrainingPlan extends Model {
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
    field: 'goal_id',
  })
  goalId!: string | null;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    field: 'start_date',
  })
  startDate!: string;

  @Column({
    type: DataType.DATEONLY,
    allowNull: false,
    field: 'end_date',
  })
  endDate!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'training_frequency',
  })
  trainingFrequency!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'weekly_target_km',
  })
  weeklyTargetKm!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: TRAINING_PLAN_STATUSES[0],
  })
  status!: (typeof TRAINING_PLAN_STATUSES)[number];

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'algorithm_version',
    defaultValue: TRAINING_LOAD_ALGORITHM_VERSION,
  })
  algorithmVersion!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
  })
  weeks!: Array<Record<string, unknown>>;
}
