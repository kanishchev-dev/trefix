import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { ATHLETE_GOAL_TYPES } from '../goal-taxonomy';

/**
 * Open metric map used by `current` / `target` nested objects. Field-level
 * validation (allowed keys, ranges) runs in the domain layer (goal-taxonomy),
 * because the allowed set depends on the goal type.
 */
export class GoalMetricsDto implements Record<string, unknown> {
  [key: string]: unknown;
}

export class AthleteGoalPayloadDto {
  @ApiProperty({ enum: ATHLETE_GOAL_TYPES })
  @IsIn(ATHLETE_GOAL_TYPES as unknown as string[])
  type!: (typeof ATHLETE_GOAL_TYPES)[number];

  @ApiPropertyOptional({ type: GoalMetricsDto, description: 'Optional current metrics' })
  @IsObject()
  @IsOptional()
  current?: Record<string, unknown>;

  @ApiPropertyOptional({ type: GoalMetricsDto, description: 'Target metrics of the goal type' })
  @IsObject()
  @IsOptional()
  target?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Free-text description for custom goals', maxLength: 2000 })
  @IsString()
  @MaxLength(2000)
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ example: '2026-10-18' })
  @IsDateString()
  @IsOptional()
  targetDate?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  priority?: number;
}

export class CreateGoalDto {
  @ApiProperty()
  @IsString()
  athleteId!: string;

  @ApiProperty({ type: AthleteGoalPayloadDto })
  @ValidateNested()
  @Type(() => AthleteGoalPayloadDto)
  goal!: AthleteGoalPayloadDto;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}

/** Flat legacy DTO kept for backward compatibility. */
export class CreateLegacyGoalDto {
  @ApiProperty()
  @IsString()
  athleteId!: string;

  @ApiProperty({ enum: ['5k', '10k', 'half_marathon', 'marathon', 'just_running'] })
  @IsIn(['5k', '10k', 'half_marathon', 'marathon', 'just_running'])
  raceDistance!: string;

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  targetTimeSeconds?: number;

  @ApiPropertyOptional({ example: '2026-12-20' })
  @IsDateString()
  @IsOptional()
  targetDate?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 5 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;
}
