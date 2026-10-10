import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
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

export const PROFILE_METRIC_SKIP_REASONS = [
  'manual_source',
  'stale',
  'out_of_range',
  'insufficient_data',
  'profile_sync_off',
] as const;

export class SkippedProfileMetricDto {
  @ApiProperty({ enum: ['weightKg', 'restingHeartRate'] })
  field!: 'weightKg' | 'restingHeartRate';

  @ApiProperty({ enum: PROFILE_METRIC_SKIP_REASONS })
  reason!: (typeof PROFILE_METRIC_SKIP_REASONS)[number];
}

export class DeviceProfileMetricsResultDto {
  @ApiProperty({ example: ['weightKg'], description: 'Fields written to the profile' })
  applied!: Array<'weightKg' | 'restingHeartRate'>;

  @ApiProperty({ type: [SkippedProfileMetricDto] })
  skipped!: SkippedProfileMetricDto[];
}
