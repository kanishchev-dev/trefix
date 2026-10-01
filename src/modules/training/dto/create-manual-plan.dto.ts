import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import {
  ATHLETE_GOAL_DISTANCES,
  MANUAL_PLAN_FOCUS_TYPES,
  MANUAL_PLAN_MAX_DISTANCE_KM,
  MANUAL_PLAN_MAX_DURATION_MINUTES,
  MANUAL_PLAN_MAX_WEEKS,
  MANUAL_PLAN_MIN_DURATION_MINUTES,
  MANUAL_PLAN_MIN_WEEKS,
  WORKOUT_TYPES,
} from '../training.constants';
import { AthleteGoalPayloadDto } from './create-goal.dto';

/**
 * Manual plan goal: universal polymorphic payload (PRD sections 9, 19).
 * Legacy flat race fields remain accepted for backward compatibility
 * (PRD section 26) and are normalised into the universal shape.
 */
export class ManualPlanGoalDto extends AthleteGoalPayloadDto {
  @ApiPropertyOptional({ enum: ATHLETE_GOAL_DISTANCES, description: 'Legacy race distance; normalised into the universal goal' })
  @IsIn(ATHLETE_GOAL_DISTANCES as unknown as string[])
  @IsOptional()
  raceDistance?: (typeof ATHLETE_GOAL_DISTANCES)[number];

  @ApiPropertyOptional({ description: 'Legacy target time in seconds; normalised into the universal goal' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  targetTimeSeconds?: number;
}

export class ManualPlanScheduleDto {
  @ApiProperty({
    description: 'Preferred training days as weekday indexes (0 = Monday)',
    type: [Number],
  })
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  trainingDays!: number[];

  @ApiPropertyOptional({ description: 'Preferred long run day as weekday index (0 = Monday)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  preferredLongRunDay?: number;

  @ApiPropertyOptional({ minimum: MANUAL_PLAN_MIN_DURATION_MINUTES, maximum: MANUAL_PLAN_MAX_DURATION_MINUTES })
  @Type(() => Number)
  @IsInt()
  @Min(MANUAL_PLAN_MIN_DURATION_MINUTES)
  @Max(MANUAL_PLAN_MAX_DURATION_MINUTES)
  @IsOptional()
  workoutDurationMinutes?: number;
}

export class ManualPlanStructureDto {
  @ApiProperty({ minimum: MANUAL_PLAN_MIN_WEEKS, maximum: MANUAL_PLAN_MAX_WEEKS })
  @Type(() => Number)
  @IsInt()
  @Min(MANUAL_PLAN_MIN_WEEKS)
  @Max(MANUAL_PLAN_MAX_WEEKS)
  totalWeeks!: number;

  @ApiProperty({ minimum: 1, maximum: 7 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  sessionsPerWeek!: number;

  @ApiPropertyOptional({ enum: MANUAL_PLAN_FOCUS_TYPES, type: [String] })
  @IsArray()
  @ArrayMaxSize(MANUAL_PLAN_FOCUS_TYPES.length)
  @IsIn(MANUAL_PLAN_FOCUS_TYPES as unknown as string[], { each: true })
  @IsOptional()
  focus?: string[];
}

export class ManualPlanWorkoutOverrideDto {
  @ApiProperty({ description: 'Planned workout identifier from the preview response' })
  @IsString()
  id!: string;

  @ApiPropertyOptional({ enum: WORKOUT_TYPES })
  @IsIn(WORKOUT_TYPES as unknown as string[])
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Weekday index (0 = Monday)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, description: 'Requested distance in km (supports fractions)' })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MANUAL_PLAN_MAX_DISTANCE_KM)
  @IsOptional()
  distanceKm?: number;

  @ApiPropertyOptional({ minimum: MANUAL_PLAN_MIN_DURATION_MINUTES, maximum: MANUAL_PLAN_MAX_DURATION_MINUTES })
  @Type(() => Number)
  @IsInt()
  @Min(MANUAL_PLAN_MIN_DURATION_MINUTES)
  @Max(MANUAL_PLAN_MAX_DURATION_MINUTES)
  @IsOptional()
  durationMinutes?: number;
}

export class ManualPlanNewWorkoutDto {
  @ApiProperty({ enum: WORKOUT_TYPES })
  @IsIn(WORKOUT_TYPES as unknown as string[])
  type!: string;

  @ApiProperty({ description: 'Weekday index (0 = Monday)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MANUAL_PLAN_MAX_DISTANCE_KM)
  @IsOptional()
  distanceKm?: number;

  @ApiProperty({ minimum: MANUAL_PLAN_MIN_DURATION_MINUTES, maximum: MANUAL_PLAN_MAX_DURATION_MINUTES })
  @Type(() => Number)
  @IsInt()
  @Min(MANUAL_PLAN_MIN_DURATION_MINUTES)
  @Max(MANUAL_PLAN_MAX_DURATION_MINUTES)
  durationMinutes!: number;
}

export class ManualPlanWeekOverrideDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weekNumber!: number;

  @ApiPropertyOptional({ type: [ManualPlanWorkoutOverrideDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualPlanWorkoutOverrideDto)
  @IsOptional()
  workoutOverrides?: ManualPlanWorkoutOverrideDto[];

  @ApiPropertyOptional({ type: [String], description: 'Preview workout ids removed by the user' })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  removedWorkoutIds?: string[];

  @ApiPropertyOptional({ type: [ManualPlanNewWorkoutDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => ManualPlanNewWorkoutDto)
  @IsOptional()
  newWorkouts?: ManualPlanNewWorkoutDto[];
}

export class PreviewManualPlanDto {
  @ApiProperty({ type: ManualPlanGoalDto })
  @ValidateNested()
  @Type(() => ManualPlanGoalDto)
  goal!: ManualPlanGoalDto;

  @ApiProperty({ type: ManualPlanScheduleDto })
  @ValidateNested()
  @Type(() => ManualPlanScheduleDto)
  schedule!: ManualPlanScheduleDto;

  @ApiProperty({ type: ManualPlanStructureDto })
  @ValidateNested()
  @Type(() => ManualPlanStructureDto)
  structure!: ManualPlanStructureDto;

  @ApiPropertyOptional({ example: '2026-09-30' })
  @IsDateString()
  @IsOptional()
  startDate?: string;
}

export class CreateManualPlanDto extends PreviewManualPlanDto {
  @ApiPropertyOptional({ type: [ManualPlanWeekOverrideDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManualPlanWeekOverrideDto)
  @IsOptional()
  weekOverrides?: ManualPlanWeekOverrideDto[];

  @ApiPropertyOptional({ maxLength: 200 })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  name?: string;
}
