import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

import { ADAPTATION_ACTIONS } from '../training.constants';

export class AdaptPlanDto {
  @ApiProperty()
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  workoutId?: string;

  @ApiPropertyOptional({ enum: ADAPTATION_ACTIONS })
  @IsIn(ADAPTATION_ACTIONS)
  @IsOptional()
  forcedAction?: (typeof ADAPTATION_ACTIONS)[number];

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  reason?: string;
}
