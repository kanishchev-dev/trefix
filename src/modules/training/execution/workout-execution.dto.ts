import { ApiProperty } from '@nestjs/swagger';

import { WORKOUT_TYPES, type WorkoutType } from '../training.constants';
import { EXECUTION_STEP_KINDS, type ExecutionStepKind } from './workout-execution.builder';

export class ExecutionTargetPaceDto {
  @ApiProperty({ example: 280 })
  minSecPerKm!: number;

  @ApiProperty({ example: 290 })
  maxSecPerKm!: number;
}

export class ExecutionRepetitionDto {
  @ApiProperty({ example: 2 })
  index!: number;

  @ApiProperty({ example: 5 })
  total!: number;
}

export class ExecutionStepDto {
  @ApiProperty({ example: 1 })
  index!: number;

  @ApiProperty({ enum: EXECUTION_STEP_KINDS })
  kind!: ExecutionStepKind;

  @ApiProperty({ example: 300, nullable: true, type: Number })
  durationSec!: number | null;

  @ApiProperty({ example: null, nullable: true, type: Number })
  distanceM!: number | null;

  @ApiProperty({ type: ExecutionTargetPaceDto, nullable: true })
  targetPace!: ExecutionTargetPaceDto | null;

  @ApiProperty({ example: 'Z4', nullable: true, type: String })
  zone!: string | null;

  @ApiProperty({ type: ExecutionRepetitionDto, nullable: true })
  repetition!: ExecutionRepetitionDto | null;
}

export class WorkoutExecutionResponseDto {
  @ApiProperty({ format: 'uuid' })
  workoutId!: string;

  @ApiProperty({ enum: WORKOUT_TYPES })
  type!: WorkoutType;

  @ApiProperty({ type: [ExecutionStepDto] })
  steps!: ExecutionStepDto[];

  @ApiProperty({ example: 3000 })
  totalDurationSec!: number;

  @ApiProperty({ example: null, nullable: true, type: Number })
  totalDistanceM!: number | null;
}
