import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { TRAINING_LOAD_ALGORITHM_VERSION } from '../training.constants';

@Table({
  tableName: 'training_loads',
  underscored: true,
  paranoid: true,
})
export class TrainingLoad extends Model {
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
    field: 'workout_id',
  })
  workoutId!: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'occurred_at',
  })
  occurredAt!: Date;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
  })
  load!: number;

  @Column({
    type: DataType.FLOAT,
    allowNull: false,
    field: 'intensity_factor',
  })
  intensityFactor!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'algorithm_version',
    defaultValue: TRAINING_LOAD_ALGORITHM_VERSION,
  })
  algorithmVersion!: string;
}
