import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class CreatePlanDto {
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

  @ApiProperty({ minimum: 1, maximum: 14, required: false })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  targetTrainingFrequency?: number;
}
