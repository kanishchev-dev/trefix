import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { PlanGoalSummaryDto } from './plan-lifecycle.dto';
import { PlanConfigDto } from './plan-shapes.dto';

export class PlanOverviewDataDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'User-given name; null means the app titles the plan by its goal',
  })
  name!: string | null;

  @ApiProperty({ type: PlanGoalSummaryDto })
  goal!: PlanGoalSummaryDto;

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

  @ApiProperty({ enum: ['completed', 'current', 'upcoming'] })
  status!: 'completed' | 'current' | 'upcoming';

  @ApiPropertyOptional()
  plannedWorkoutsCount?: number;

  @ApiPropertyOptional()
  plannedDistance?: number;

  @ApiPropertyOptional()
  plannedLoad?: number;

  @ApiProperty({ type: () => [KeySessionDto], description: 'Quality workouts of the week' })
  keySessions!: KeySessionDto[];
}

export class KeySessionDto {
  @ApiProperty({ description: 'Workout type code' })
  type!: string;

  @ApiProperty()
  distanceKm!: number;
}

export class CurrentWeekContextDto {
  @ApiProperty()
  weekNumber!: number;

  @ApiProperty({ enum: ['BASE', 'BUILD', 'RECOVERY', 'SPECIFIC', 'PEAK', 'TAPER', 'RACE'] })
  phase!: string;

  @ApiProperty({ type: () => [KeySessionDto] })
  keySessions!: KeySessionDto[];
}

export class PlanAdaptationDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  weekId?: string;

  @ApiPropertyOptional()
  weekNumber?: number;

  @ApiProperty({
    description: 'Adaptation action code: ADD_RECOVERY, REDUCE_INTENSITY, REDUCE_VOLUME, MOVE, REPLACE, …',
  })
  type!: string;

  @ApiPropertyOptional({
    description: 'Reason code (high_fatigue, low_recovery, heart_rate_zones_changed, …) or text written by the coach',
  })
  reason?: string;

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
