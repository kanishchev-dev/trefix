import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { ATHLETE_EXPERIENCE_LEVELS, ATHLETE_SEX_VALUES, TRAINING_DEFAULT_AVAILABILITY } from '../training.constants';

@Table({
  tableName: 'athletes',
  underscored: true,
  paranoid: true,
})
export class Athlete extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
    unique: true,
    field: 'user_id',
  })
  userId!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  age!: number | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  sex!: (typeof ATHLETE_SEX_VALUES)[number] | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'height_cm',
  })
  heightCm!: number | null;

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
    field: 'weight_kg',
  })
  weightKg!: number | null;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'experience_level',
    defaultValue: ATHLETE_EXPERIENCE_LEVELS[1],
  })
  experienceLevel!: (typeof ATHLETE_EXPERIENCE_LEVELS)[number];

  @Column({
    type: DataType.FLOAT,
    allowNull: true,
    field: 'weekly_mileage_km',
  })
  weeklyMileageKm!: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    field: 'sessions_per_week',
    defaultValue: 4,
  })
  sessionsPerWeek!: number;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    field: 'recent_race_results',
    defaultValue: [],
  })
  recentRaceResults!: Array<Record<string, unknown>>;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    field: 'preferred_training_days',
    defaultValue: [...TRAINING_DEFAULT_AVAILABILITY],
  })
  preferredTrainingDays!: string[];

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    field: 'available_training_days',
    defaultValue: [...TRAINING_DEFAULT_AVAILABILITY],
  })
  availableTrainingDays!: string[];

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'preferred_workout_duration_minutes',
  })
  preferredWorkoutDurationMinutes!: number | null;
}
