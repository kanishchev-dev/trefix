import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';

import type { TrainingPhase, WorkoutType } from '../training.constants';
import { TRAINING_PHASES, WORKOUT_TYPES } from '../training.constants';
import { StartOptionsResponseDto } from './plan-lifecycle.dto';

export class ManualPlanPreviewWorkoutDto {
  @ApiProperty({ description: 'Stable preview identifier, e.g. "1-1" for week 1 workout 1' })
  id!: string;

  @ApiProperty({ enum: WORKOUT_TYPES })
  type!: WorkoutType;

  @ApiProperty({ enum: TRAINING_PHASES })
  phase!: TrainingPhase | string;

  @ApiProperty()
  weekNumber!: number;

  @ApiProperty({ description: 'Weekday index (0 = Monday)' })
  dayOfWeek!: number;

  @ApiProperty({ description: 'ISO date of the session within the plan' })
  scheduledAt!: string;

  @ApiProperty()
  orderInWeek!: number;

  @ApiProperty()
  durationMinutes!: number;

  @ApiProperty()
  distanceKm!: number;

  @ApiProperty({ type: 'object', additionalProperties: true })
  target!: Record<string, unknown>;

  @ApiProperty({ type: [Object] })
  steps!: Array<Record<string, unknown>>;
}

export class ManualPlanPreviewWeekDto {
  @ApiProperty()
  weekNumber!: number;

  @ApiProperty({ enum: ['BASE', 'BUILD', 'RECOVERY', 'SPECIFIC', 'PEAK', 'TAPER', 'RACE'] })
  phase!: string;

  @ApiProperty()
  plannedWorkoutsCount!: number;

  @ApiProperty()
  plannedDistance!: number;

  @ApiProperty()
  plannedLoad!: number;

  @ApiProperty({ type: [ManualPlanPreviewWorkoutDto] })
  workouts!: ManualPlanPreviewWorkoutDto[];
}

export class ManualPlanPreviewResponseDto {
  @ApiProperty()
  startDate!: string;

  @ApiProperty()
  endDate!: string;

  @ApiProperty()
  totalWeeks!: number;

  @ApiProperty()
  trainingFrequency!: number;

  @ApiProperty()
  weeklyTargetKm!: number;

  @ApiProperty({ type: [ManualPlanPreviewWeekDto] })
  weeks!: ManualPlanPreviewWeekDto[];

  @ApiPropertyOptional({
    type: StartOptionsResponseDto,
    description: 'Start options for the confirmation sheet shown before the plan is saved',
  })
  startOptions?: StartOptionsResponseDto;
}

/** Dated preview of a rebuilt plan: the manual preview without start options (they come alongside). */
export class DatedPlanPreviewDto extends OmitType(ManualPlanPreviewResponseDto, ['startOptions'] as const) {}
