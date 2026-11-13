import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { RESTING_HR_MAX_SAMPLES } from '../../constants/integrations.constants';

/** Health stores report `other` too; the profile keeps only female/male, so `other` is ignored. */
export const DEVICE_PROFILE_SEX_VALUES = ['female', 'male', 'other'] as const;

export class DeviceWeightDto {
  @ApiProperty({ example: 71.4 })
  @IsNumber()
  @Min(0)
  valueKg!: number;

  @ApiProperty({ example: '2026-10-09T05:40:00Z' })
  @IsISO8601()
  measuredAt!: string;

  @ApiPropertyOptional({ example: 'com.withings.wiScaleNG' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originAppId?: string;
}

export class DeviceHeightDto {
  @ApiProperty({ example: 181 })
  @IsNumber()
  @Min(0)
  valueCm!: number;

  @ApiProperty({ example: '2026-10-09T05:40:00Z' })
  @IsISO8601()
  measuredAt!: string;

  @ApiPropertyOptional({ example: 'com.apple.Health' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originAppId?: string;
}

export class DeviceRestingHeartRateDto {
  @ApiProperty({ example: '2026-10-08' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;

  @ApiProperty({ example: 52 })
  @IsInt()
  @Min(0)
  bpm!: number;
}

export class DeviceProfileMetricsDto {
  @ApiPropertyOptional({ type: DeviceWeightDto, description: 'Latest measurement' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceWeightDto)
  weight?: DeviceWeightDto;

  @ApiPropertyOptional({ type: DeviceHeightDto, description: 'Latest measurement' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceHeightDto)
  height?: DeviceHeightDto;

  @ApiPropertyOptional({ enum: DEVICE_PROFILE_SEX_VALUES, description: 'iOS: HealthKit biological sex' })
  @IsOptional()
  @IsIn(DEVICE_PROFILE_SEX_VALUES)
  sex?: (typeof DEVICE_PROFILE_SEX_VALUES)[number];

  @ApiPropertyOptional({ example: '1990-04-12', description: 'iOS: HealthKit date of birth' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  birthDate?: string;

  @ApiPropertyOptional({
    type: [DeviceRestingHeartRateDto],
    description: `Daily values, up to ${RESTING_HR_MAX_SAMPLES}`,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(RESTING_HR_MAX_SAMPLES)
  @ValidateNested({ each: true })
  @Type(() => DeviceRestingHeartRateDto)
  restingHeartRate?: DeviceRestingHeartRateDto[];
}

export const PROFILE_METRIC_FIELDS = ['weightKg', 'heightCm', 'sex', 'birthDate', 'restingHeartRate'] as const;
export type ProfileMetricField = (typeof PROFILE_METRIC_FIELDS)[number];

export const PROFILE_METRIC_SKIP_REASONS = [
  'manual_source',
  'stale',
  'out_of_range',
  'insufficient_data',
  'profile_sync_off',
] as const;

export class SkippedProfileMetricDto {
  @ApiProperty({ enum: PROFILE_METRIC_FIELDS })
  field!: ProfileMetricField;

  @ApiProperty({ enum: PROFILE_METRIC_SKIP_REASONS })
  reason!: (typeof PROFILE_METRIC_SKIP_REASONS)[number];
}

export class DeviceProfileMetricsResultDto {
  @ApiProperty({ example: ['weightKg'], description: 'Fields written to the profile' })
  applied!: ProfileMetricField[];

  @ApiProperty({ type: [SkippedProfileMetricDto] })
  skipped!: SkippedProfileMetricDto[];
}
