import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

import { ATHLETE_GOAL_DISTANCES } from '../training.constants';

export class CreateGoalDto {
  @ApiProperty()
  @IsUUID()
  athleteId!: string;

  @ApiProperty({ enum: ATHLETE_GOAL_DISTANCES })
  @IsIn(ATHLETE_GOAL_DISTANCES)
  raceDistance!: (typeof ATHLETE_GOAL_DISTANCES)[number];

  @ApiPropertyOptional({ minimum: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  targetTimeSeconds?: number;

  @ApiProperty({ example: '2026-12-20' })
  @IsDateString()
  targetDate!: string;

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
