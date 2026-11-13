import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

import {
  PROGRESS_PERIODS,
  type ProgressPeriodKey,
  RACE_RESULT_KINDS,
  type RaceResultKind,
} from '../../training.constants';

export class ProgressPeriodQueryDto {
  @ApiPropertyOptional({ enum: PROGRESS_PERIODS, default: '3M' })
  @IsOptional()
  @IsIn(PROGRESS_PERIODS)
  period?: ProgressPeriodKey;
}

export class CreateResultDto {
  @ApiProperty({ example: 21098, minimum: 400, maximum: 100000 })
  @Type(() => Number)
  @IsInt()
  @Min(400)
  @Max(100000)
  distanceM!: number;

  @ApiProperty({ example: 6362, description: 'Finish time, seconds' })
  @Type(() => Number)
  @IsInt()
  @Min(60)
  timeSeconds!: number;

  @ApiProperty({ example: '2026-09-20' })
  @IsISO8601({ strict: true })
  date!: string;

  @ApiProperty({ enum: RACE_RESULT_KINDS, example: 'race' })
  @IsIn(RACE_RESULT_KINDS)
  kind!: RaceResultKind;

  @ApiPropertyOptional({ example: 'Московский полумарафон', maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}

export class RecordsExclusionDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  excluded!: boolean;
}
