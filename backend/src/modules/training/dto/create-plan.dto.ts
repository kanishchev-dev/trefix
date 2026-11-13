import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsObject, IsOptional, IsUUID, Max, Min, ValidateNested } from 'class-validator';

import { AthleteMetricsDto, PlanSaveFieldsDto } from './plan-metrics.dto';

/** Engine-generated plan for an existing goal (AI flow). */
export class CreatePlanDto extends PlanSaveFieldsDto {
  @ApiProperty()
  @IsUUID()
  athleteId!: string;

  @ApiProperty()
  @IsUUID()
  goalId!: string;

  @ApiProperty({ example: '2026-09-11', required: false })
  @IsDateString()
  @IsOptional()
  startDate?: string;

  @ApiProperty({ minimum: 1, maximum: 7, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7)
  @IsOptional()
  targetTrainingFrequency?: number;

  @ApiPropertyOptional({ type: AthleteMetricsDto, description: 'User-entered current metrics' })
  @ValidateNested()
  @Type(() => AthleteMetricsDto)
  @IsOptional()
  metrics?: AthleteMetricsDto;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Schedule the plan was configured with, stored in the plan config',
  })
  @IsObject()
  @IsOptional()
  scheduleSnapshot?: Record<string, unknown>;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: 'Structure the plan was configured with, stored in the plan config',
  })
  @IsObject()
  @IsOptional()
  structureSnapshot?: Record<string, unknown>;
}
