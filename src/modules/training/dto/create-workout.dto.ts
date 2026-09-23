import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString, Min } from 'class-validator';

import { WORKOUT_TYPES, WorkoutType } from '../training.constants';

export class CreateWorkoutDto {
  @ApiProperty({ example: '2026-09-23T10:00:00.000Z' })
  @IsDateString()
  scheduledAt!: string;

  @ApiProperty({ enum: WORKOUT_TYPES, required: false, default: 'easy' })
  @IsEnum(WORKOUT_TYPES)
  @IsOptional()
  type?: WorkoutType;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ minimum: 0, required: false, default: 30 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  durationMinutes?: number;

  @ApiProperty({ minimum: 0, required: false, default: 5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  distanceKm?: number;

  @ApiProperty({ enum: ['planned', 'completed'], required: false, default: 'planned' })
  @IsEnum(['planned', 'completed'])
  @IsOptional()
  status?: 'planned' | 'completed';

  @ApiProperty({ minimum: 0, required: false })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  actualDurationMinutes?: number;

  @ApiProperty({ minimum: 0, required: false })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  actualDistanceKm?: number;

  @ApiProperty({ minimum: 0, required: false })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  actualAveragePaceSecondsPerKm?: number;

  @ApiProperty({ minimum: 0, required: false })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  actualAverageHeartRate?: number;

  @ApiProperty({ minimum: 0, required: false })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  rpe?: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
