import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

import { WORKOUT_TYPES, WorkoutType } from '../training.constants';

/** Changes to a workout the user added by hand; plan workouts are edited through the plan. */
export class UpdateWorkoutDto {
  @ApiProperty({ required: false, example: '2026-10-20T09:00:00.000Z', description: 'New day; tomorrow or later' })
  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @ApiProperty({ enum: WORKOUT_TYPES, required: false })
  @IsEnum(WORKOUT_TYPES)
  @IsOptional()
  type?: WorkoutType;

  @ApiProperty({ minimum: 1, maximum: 600, required: false })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(600)
  @IsOptional()
  durationMinutes?: number;

  @ApiProperty({ minimum: 0.1, maximum: 300, required: false })
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  @Max(300)
  @IsOptional()
  distanceKm?: number;
}
