import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({ enum: ['not_started', 'active', 'completed'] })
  status!: 'not_started' | 'active' | 'completed';

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
