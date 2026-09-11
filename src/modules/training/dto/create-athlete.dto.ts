import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

import { ATHLETE_EXPERIENCE_LEVELS, ATHLETE_SEX_VALUES, TRAINING_DEFAULT_AVAILABILITY } from '../training.constants';

function normalizeStringArray(value: unknown): string[] | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  const values = Array.isArray(value) ? value : [value];
  return values.map((entry) => String(entry).trim().toLowerCase()).filter(Boolean);
}

export class CreateAthleteDto {
  @ApiPropertyOptional({ minimum: 14, maximum: 100 })
  @Type(() => Number)
  @IsInt()
  @Min(14)
  @Max(100)
  @IsOptional()
  age?: number;

  @ApiPropertyOptional({ enum: ATHLETE_SEX_VALUES })
  @IsIn(ATHLETE_SEX_VALUES)
  @IsOptional()
  sex?: (typeof ATHLETE_SEX_VALUES)[number];

  @ApiPropertyOptional({ minimum: 120 })
  @Type(() => Number)
  @IsInt()
  @Min(120)
  @IsOptional()
  heightCm?: number;

  @ApiPropertyOptional({ minimum: 30 })
  @Type(() => Number)
  @IsNumber()
  @Min(30)
  @IsOptional()
  weightKg?: number;

  @ApiProperty({ enum: ATHLETE_EXPERIENCE_LEVELS })
  @IsIn(ATHLETE_EXPERIENCE_LEVELS)
  experienceLevel!: (typeof ATHLETE_EXPERIENCE_LEVELS)[number];

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  weeklyMileageKm?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 14, default: 4 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  @IsOptional()
  sessionsPerWeek?: number;

  @ApiPropertyOptional({ type: [Object] })
  @IsArray()
  @IsOptional()
  recentRaceResults?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ type: [String], default: TRAINING_DEFAULT_AVAILABILITY })
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @IsOptional()
  preferredTrainingDays?: string[];

  @ApiPropertyOptional({ type: [String], default: TRAINING_DEFAULT_AVAILABILITY })
  @Transform(({ value }) => normalizeStringArray(value))
  @IsArray()
  @IsOptional()
  availableTrainingDays?: string[];

  @ApiPropertyOptional({ minimum: 15 })
  @Type(() => Number)
  @IsInt()
  @Min(15)
  @IsOptional()
  preferredWorkoutDurationMinutes?: number;
}
