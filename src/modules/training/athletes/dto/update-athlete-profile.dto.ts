import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import {
  ATHLETE_EXPERIENCE_LEVELS,
  ATHLETE_LIMITATIONS_MAX_LENGTH,
  ATHLETE_SEX_VALUES,
  ATHLETE_SOURCED_FIELDS,
  type AthleteExperienceLevel,
  type AthleteSexValue,
  type AthleteSourcedField,
  HR_ZONES_METHODS,
  type HrZonesMethod,
  type TimeOfDay,
  TIMES_OF_DAY,
  TRAINING_WEEKDAY_ORDER,
  type TrainingWeekday,
} from '../../training.constants';

const lowerCaseArray = ({ value }: { value: unknown }): unknown =>
  Array.isArray(value) ? value.map((entry) => String(entry).trim().toLowerCase()) : value;

/**
 * Partial update of the own athlete profile. `null` clears a nullable field.
 * Ranges are checked by the service so errors carry `ATHLETE_*` codes.
 */
export class UpdateAthleteProfileDto {
  @ApiPropertyOptional({ type: String, nullable: true, example: '1992-03-14' })
  @IsOptional()
  @IsISO8601({ strict: true })
  birthDate?: string | null;

  @ApiPropertyOptional({ enum: ATHLETE_SEX_VALUES, nullable: true })
  @IsOptional()
  @IsIn(ATHLETE_SEX_VALUES)
  sex?: AthleteSexValue | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 181 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  heightCm?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 72.4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  weightKg?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 52 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  restingHeartRate?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 189 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  maxHeartRate?: number | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 172,
    description: 'Lactate threshold heart rate (LTHR)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  thresholdHeartRate?: number | null;

  @ApiPropertyOptional({ enum: HR_ZONES_METHODS })
  @IsOptional()
  @IsIn(HR_ZONES_METHODS)
  hrZonesMethod?: HrZonesMethod;

  @ApiPropertyOptional({
    type: [Number],
    nullable: true,
    example: [134, 150, 162, 176],
    description: 'Upper bounds of Z1–Z4, strictly increasing',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  hrZonesCustom?: number[] | null;

  @ApiPropertyOptional({ enum: ATHLETE_EXPERIENCE_LEVELS })
  @IsOptional()
  @IsIn(ATHLETE_EXPERIENCE_LEVELS)
  experienceLevel?: AthleteExperienceLevel;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 2021 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  runningSinceYear?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '',
    maxLength: ATHLETE_LIMITATIONS_MAX_LENGTH,
    description: 'Injuries and limitations; empty string means "no limitations"',
  })
  @IsOptional()
  @IsString()
  @MaxLength(ATHLETE_LIMITATIONS_MAX_LENGTH)
  limitations?: string | null;

  @ApiPropertyOptional({ type: [String], enum: TRAINING_WEEKDAY_ORDER, example: ['monday', 'wednesday', 'saturday'] })
  @IsOptional()
  @Transform(lowerCaseArray)
  @IsArray()
  @ArrayMaxSize(7)
  @IsIn(TRAINING_WEEKDAY_ORDER, { each: true })
  availableTrainingDays?: TrainingWeekday[];

  @ApiPropertyOptional({ enum: TIMES_OF_DAY })
  @IsOptional()
  @IsIn(TIMES_OF_DAY)
  preferredTimeOfDay?: TimeOfDay;

  @ApiPropertyOptional({ example: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sessionsPerWeek?: number;

  @ApiPropertyOptional({ enum: TRAINING_WEEKDAY_ORDER, nullable: true })
  @IsOptional()
  @IsIn(TRAINING_WEEKDAY_ORDER)
  longRunDay?: TrainingWeekday | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 60 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  preferredWorkoutDurationMinutes?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  longRunMaxDurationMinutes?: number | null;

  @ApiPropertyOptional({ type: Number, nullable: true, example: 30 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  weeklyMileageKm?: number | null;

  @ApiPropertyOptional({
    type: [String],
    enum: ATHLETE_SOURCED_FIELDS,
    description: 'Fields to hand back to the external source: the next sync overwrites them again',
  })
  @IsOptional()
  @IsArray()
  @IsIn(ATHLETE_SOURCED_FIELDS, { each: true })
  resetSources?: AthleteSourcedField[];
}
