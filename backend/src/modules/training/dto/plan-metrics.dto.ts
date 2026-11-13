import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PLAN_METRIC_RANGES, PLAN_NAME_MAX_LENGTH, PLAN_NOTES_MAX_LENGTH } from '../training.constants';

/** A recent race-like result used to estimate the threshold pace. */
export class RecentResultDto {
  @ApiProperty({ example: 'half_marathon', description: 'Distance key: 5k | 10k | half_marathon | marathon' })
  @IsString()
  @IsNotEmpty()
  distance!: string;

  @ApiProperty({ example: 5820, description: 'Finish time in seconds' })
  @Type(() => Number)
  @IsInt()
  @Min(60)
  timeSeconds!: number;

  @ApiProperty({ example: '2026-04-20' })
  @IsDateString()
  date!: string;
}

/**
 * Current metrics entered by the user during creation or rebuild. Every
 * field is optional: missing values fall back to the athlete state estimate.
 */
export class AthleteMetricsDto {
  @ApiPropertyOptional({
    minimum: PLAN_METRIC_RANGES.thresholdPaceSecondsPerKm.min,
    maximum: PLAN_METRIC_RANGES.thresholdPaceSecondsPerKm.max,
    description: 'Threshold pace in seconds per km',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(PLAN_METRIC_RANGES.thresholdPaceSecondsPerKm.min)
  @Max(PLAN_METRIC_RANGES.thresholdPaceSecondsPerKm.max)
  @IsOptional()
  thresholdPaceSecondsPerKm?: number;

  @ApiPropertyOptional({ minimum: 100, maximum: 230, description: 'Threshold heart rate in bpm' })
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(230)
  @IsOptional()
  thresholdHeartRate?: number;

  @ApiPropertyOptional({
    minimum: PLAN_METRIC_RANGES.maxHeartRate.min,
    maximum: PLAN_METRIC_RANGES.maxHeartRate.max,
    description: 'Maximum heart rate in bpm',
  })
  @Type(() => Number)
  @IsInt()
  @Min(PLAN_METRIC_RANGES.maxHeartRate.min)
  @Max(PLAN_METRIC_RANGES.maxHeartRate.max)
  @IsOptional()
  maxHeartRate?: number;

  @ApiPropertyOptional({
    minimum: PLAN_METRIC_RANGES.restingHeartRate.min,
    maximum: PLAN_METRIC_RANGES.restingHeartRate.max,
    description: 'Resting heart rate in bpm',
  })
  @Type(() => Number)
  @IsInt()
  @Min(PLAN_METRIC_RANGES.restingHeartRate.min)
  @Max(PLAN_METRIC_RANGES.restingHeartRate.max)
  @IsOptional()
  restingHeartRate?: number;

  @ApiPropertyOptional({
    minimum: PLAN_METRIC_RANGES.weeklyMileageKm.min,
    maximum: PLAN_METRIC_RANGES.weeklyMileageKm.max,
    description: 'Current weekly mileage in km',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(PLAN_METRIC_RANGES.weeklyMileageKm.min)
  @Max(PLAN_METRIC_RANGES.weeklyMileageKm.max)
  @IsOptional()
  weeklyMileageKm?: number;

  @ApiPropertyOptional({
    minimum: PLAN_METRIC_RANGES.longestRunKm.min,
    maximum: PLAN_METRIC_RANGES.longestRunKm.max,
    description: 'Longest recent run in km',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(PLAN_METRIC_RANGES.longestRunKm.min)
  @Max(PLAN_METRIC_RANGES.longestRunKm.max)
  @IsOptional()
  longestRunKm?: number;

  @ApiPropertyOptional({
    type: RecentResultDto,
    description: 'Best recent result, used to estimate the threshold pace',
  })
  @ValidateNested()
  @Type(() => RecentResultDto)
  @IsOptional()
  recentResult?: RecentResultDto;
}

/** Start block: creates and starts a plan in one transaction. */
export class PlanStartBlockDto {
  @ApiProperty({ example: '2026-06-01' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2026-09-20', description: 'Overrides the goal target date of this run' })
  @IsDateString()
  @IsOptional()
  goalTargetDate?: string;

  @ApiProperty({ description: 'Must be true to replace an already active plan; the client asks the user first' })
  @Type(() => Boolean)
  @IsBoolean()
  replaceActive!: boolean;

  @ApiPropertyOptional({ example: 'Europe/Moscow', description: 'IANA timezone of the athlete' })
  @IsTimeZone()
  @IsOptional()
  timezone?: string;
}

/** Name, notes and save mode shared by every plan creation endpoint. */
export class PlanSaveFieldsDto {
  @ApiPropertyOptional({ maxLength: PLAN_NAME_MAX_LENGTH, description: 'Defaults to the goal summary' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(PLAN_NAME_MAX_LENGTH)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: PLAN_NOTES_MAX_LENGTH })
  @IsString()
  @MaxLength(PLAN_NOTES_MAX_LENGTH)
  @IsOptional()
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Store the plan as a draft without starting it' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  saveAsDraft?: boolean;

  @ApiPropertyOptional({
    type: PlanStartBlockDto,
    description:
      'Create and start in one transaction. Without `saveAsDraft` and `start` the deprecated behavior applies: the plan starts at once and replaces the active one',
  })
  @ValidateNested()
  @Type(() => PlanStartBlockDto)
  @IsOptional()
  start?: PlanStartBlockDto;
}
