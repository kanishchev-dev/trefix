import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

import { WORKOUT_GOALS, WORKOUT_TYPES, WorkoutGoal, WorkoutType } from '../training.constants';

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

  @ApiProperty({
    enum: WORKOUT_GOALS,
    required: false,
    description:
      'Goal of the workout. When set, only the goal value is stored: `duration` keeps durationMinutes, ' +
      '`distance` keeps distanceKm (and timeLimitMin as its duration), the other value stays 0.',
  })
  @IsIn(WORKOUT_GOALS)
  @IsOptional()
  goal?: WorkoutGoal;

  @ApiProperty({
    minimum: 1,
    maximum: 600,
    required: false,
    description: 'Distance goal only: finish the distance within this many minutes (sets the target pace).',
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(600)
  @IsOptional()
  timeLimitMin?: number;

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

  @ApiProperty({ required: false, example: 'manual' })
  @IsString()
  @IsOptional()
  source?: string;
}
