import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { TrainingPhase, WorkoutType } from '../training.constants';
import { StartOptionsResponseDto } from './plan-lifecycle.dto';

export class ManualPlanPreviewWorkoutDto {
  @ApiProperty({ description: 'Stable preview identifier, e.g. "1-1" for week 1 workout 1' })
  id!: string;

  @ApiProperty({ enum: ['recovery', 'easy', 'long_run', 'tempo', 'threshold', 'interval', 'hill', 'race', 'rest'] })
  type!: WorkoutType;

  @ApiProperty({ enum: ['base', 'build', 'recovery', 'specific', 'peak', 'taper', 'race'] })
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

  @ApiProperty({ type: Object })
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
  title!: string;

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
