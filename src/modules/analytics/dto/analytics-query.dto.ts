import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsTimeZone, Max, Min } from 'class-validator';

import {
  ANALYTICS_PERIODS,
  ANALYTICS_RANGES,
  type AnalyticsPeriod,
  type AnalyticsRange,
  ATTENTION_SORTS,
  ATTENTION_TYPES,
  type AttentionSort,
  type AttentionType,
} from '../analytics.constants';

const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' || value === true ? true : value === 'false' || value === false ? false : value;

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: ANALYTICS_PERIODS, default: '30d', description: 'Reporting period ending today' })
  @IsOptional()
  @IsIn(ANALYTICS_PERIODS)
  period?: AnalyticsPeriod;

  @ApiPropertyOptional({
    example: 'Europe/Moscow',
    description: 'IANA timezone of day boundaries; ANALYTICS_DEFAULT_TIMEZONE when omitted',
  })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({ type: Boolean, default: false, description: 'Count staff (holders of admin permissions) too' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeStaff?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: false, description: 'Recompute instead of serving the cached block' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  refresh?: boolean;
}

export class AnalyticsActivityQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({ enum: ANALYTICS_RANGES, default: '90d', description: 'Range of the activity chart' })
  @IsOptional()
  @IsIn(ANALYTICS_RANGES)
  range?: AnalyticsRange;
}

export class AnalyticsAttentionQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({
    enum: ATTENTION_TYPES,
    isArray: true,
    description: 'Kinds of problems; comma-separated or repeated',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.split(',').filter(Boolean) : Array.isArray(value) ? value : undefined,
  )
  @IsIn(ATTENTION_TYPES, { each: true })
  type?: AttentionType[];

  @ApiPropertyOptional({ enum: ATTENTION_SORTS, default: 'severity' })
  @IsOptional()
  @IsIn(ATTENTION_SORTS)
  sortBy?: AttentionSort;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
