import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PlanConfigDto } from './plan-shapes.dto';

export class PlanGoalDto {
  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  distance!: string;

  @ApiPropertyOptional()
  targetTime?: string;

  @ApiPropertyOptional()
  targetDate?: string;
}

export class PlanOverviewDataDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  name?: string;

  @ApiProperty({ type: PlanGoalDto })
  goal!: PlanGoalDto;

  @ApiProperty({ enum: ['not_started', 'active', 'completed', 'cancelled'] })
  status!: 'not_started' | 'active' | 'completed' | 'cancelled';

  @ApiProperty()
  currentWeek!: number;

  @ApiProperty()
  totalWeeks!: number;

  @ApiProperty()
  progress!: number;

  @ApiProperty({ enum: ['BASE', 'BUILD', 'RECOVERY', 'SPECIFIC', 'PEAK', 'TAPER', 'RACE'] })
  currentPhase!: string;

  @ApiPropertyOptional()
  startDate?: string;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ description: 'Version to pass as expectedVersion when editing the plan' })
  version!: number;

  @ApiProperty({ type: PlanConfigDto, description: 'Goal, schedule and structure the plan was built from' })
  config!: Record<string, unknown>;
}

export class PlanWeekDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  weekNumber!: number;

  @ApiProperty({ enum: ['BASE', 'BUILD', 'RECOVERY', 'SPECIFIC', 'PEAK', 'TAPER', 'RACE'] })
  phase!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty({ enum: ['completed', 'current', 'upcoming'] })
  status!: 'completed' | 'current' | 'upcoming';

  @ApiPropertyOptional()
  plannedWorkoutsCount?: number;

  @ApiPropertyOptional()
  plannedDistance?: number;

  @ApiPropertyOptional()
  plannedLoad?: number;

  @ApiPropertyOptional()
  summaryText?: string;

  @ApiPropertyOptional()
  intent?: string;

  @ApiPropertyOptional({ type: [String] })
  keySessions?: string[];
}

export class CurrentWeekContextDto {
  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional({ type: [String] })
  focusItems?: string[];
}

export class PlanAdaptationDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  weekId?: string;

  @ApiPropertyOptional()
  weekNumber?: number;

  @ApiProperty({
    enum: [
      'HIGH_FATIGUE',
      'MISSED_WORKOUT',
      'POOR_PERFORMANCE',
      'EXCELLENT_PERFORMANCE',
      'LOW_RECOVERY',
      'SCHEDULE_CHANGE',
      'GOAL_CHANGE',
    ],
  })
  type!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty()
  createdAt!: string;
}

export class PlanOverviewResponseDto {
  @ApiProperty({ type: PlanOverviewDataDto })
  plan!: PlanOverviewDataDto;

  @ApiProperty({ type: [PlanWeekDto] })
  weeks!: PlanWeekDto[];

  @ApiPropertyOptional({ type: CurrentWeekContextDto })
  currentWeekContext?: CurrentWeekContextDto;

  @ApiProperty({ type: [PlanAdaptationDto] })
  adaptations!: PlanAdaptationDto[];
}
