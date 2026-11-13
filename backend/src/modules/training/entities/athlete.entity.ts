import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import {
  ATHLETE_EXPERIENCE_LEVELS,
  ATHLETE_SEX_VALUES,
  type AthleteFieldSources,
  HR_ZONES_METHOD_DEFAULT,
  type HrZonesMethod,
  type TimeOfDay,
  TRAINING_DEFAULT_AVAILABILITY,
  type TrainingWeekday,
} from '../training.constants';

/** NUMERIC columns come back from pg as strings. */
const toNumberOrNull = (value: unknown): number | null =>
  value === null || value === undefined ? null : Number(value);

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

  /** Deprecated: superseded by `birthDate`, kept until the next release. */
  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  age!: number | null;

  /** ISO date `YYYY-MM-DD`. */
  @Column({
    type: DataType.DATEONLY,
    allowNull: true,
    field: 'birth_date',
  })
  birthDate!: string | null;

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
    type: DataType.DECIMAL(5, 1),
    allowNull: true,
    field: 'weight_kg',
    get(this: Athlete): number | null {
      return toNumberOrNull(this.getDataValue('weightKg'));
    },
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

  /** Two workouts on one day; only for advanced athletes. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false, field: 'allow_doubles' })
  allowDoubles!: boolean;

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

  @Column({
    type: DataType.SMALLINT,
    allowNull: true,
    field: 'resting_heart_rate',
  })
  restingHeartRate!: number | null;

  @Column({
    type: DataType.SMALLINT,
    allowNull: true,
    field: 'max_heart_rate',
  })
  maxHeartRate!: number | null;

  @Column({
    type: DataType.SMALLINT,
    allowNull: true,
    field: 'threshold_heart_rate',
  })
  thresholdHeartRate!: number | null;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    field: 'hr_zones_method',
    defaultValue: HR_ZONES_METHOD_DEFAULT,
  })
  hrZonesMethod!: HrZonesMethod;

  /** Upper bounds of Z1–Z4, strictly increasing. */
  @Column({
    type: DataType.JSONB,
    allowNull: true,
    field: 'hr_zones_custom',
  })
  hrZonesCustom!: number[] | null;

  @Column({
    type: DataType.SMALLINT,
    allowNull: true,
    field: 'running_since_year',
  })
  runningSinceYear!: number | null;

  /** `null` — not answered yet, empty string — "no limitations". */
  @Column({
    type: DataType.STRING(500),
    allowNull: true,
  })
  limitations!: string | null;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    field: 'preferred_time_of_day',
    defaultValue: 'any',
  })
  preferredTimeOfDay!: TimeOfDay;

  @Column({
    type: DataType.STRING(16),
    allowNull: true,
    field: 'long_run_day',
  })
  longRunDay!: TrainingWeekday | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    field: 'long_run_max_duration_minutes',
  })
  longRunMaxDurationMinutes!: number | null;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    field: 'field_sources',
    defaultValue: {},
  })
  fieldSources!: AthleteFieldSources;
}
