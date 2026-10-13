import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import type { PlanDetails } from '../plans/plan-list.service';
import { TRAINING_PLAN_STATUSES, type TrainingPlanStatus } from '../training.constants';
import { PlanGoalSummaryDto, PlanStatsDto } from './plan-lifecycle.dto';
import { MetricsSnapshotDto, PlanConfigDto, PlanDetailsWeekDto, PlanWorkoutItemDto } from './plan-shapes.dto';

/** Plan details; `weeks` are relative for drafts and dated otherwise. */
export class PlanDetailsDto implements PlanDetails {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'User-given name; null means the app titles the plan by its goal',
  })
  name!: string | null;

  @ApiProperty({ enum: TRAINING_PLAN_STATUSES })
  status!: TrainingPlanStatus;

  @ApiProperty()
  creationSource!: string;

  @ApiProperty({ type: PlanGoalSummaryDto })
  goal!: PlanGoalSummaryDto;

  @ApiProperty()
  totalWeeks!: number;

  @ApiProperty({ type: Number, nullable: true })
  sessionsPerWeek!: number | null;

  @ApiProperty({ type: String, nullable: true })
  startDate!: string | null;

  @ApiProperty({ type: String, nullable: true })
  endDate!: string | null;

  @ApiProperty({ type: String, nullable: true })
  cancelledAt!: string | null;

  @ApiProperty({ type: String, nullable: true })
  cancelReason!: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty()
  version!: number;

  @ApiProperty({ type: PlanConfigDto })
  config!: PlanDetails['config'];

  @ApiProperty({ type: MetricsSnapshotDto, nullable: true })
  metricsSnapshot!: MetricsSnapshotDto | null;

  @ApiProperty({ type: String, nullable: true })
  sourcePlanId!: string | null;

  @ApiProperty({ type: PlanStatsDto, nullable: true })
  stats!: PlanStatsDto | null;

  @ApiPropertyOptional()
  metricsStale?: boolean;

  @ApiPropertyOptional({ description: 'Active plans only' })
  currentWeek?: number;

  @ApiPropertyOptional({ description: 'Active plans only, 0..1' })
  progress?: number;

  @ApiProperty({ type: String, nullable: true })
  replacedByPlanId!: string | null;

  @ApiProperty({
    type: [PlanWorkoutItemDto],
    description: 'Dated plans: planned and actual workouts (cancelled excluded)',
  })
  workouts!: PlanWorkoutItemDto[];

  @ApiProperty({ type: [PlanDetailsWeekDto] })
  weeks!: Array<Record<string, unknown>>;

  @ApiProperty()
  updatedAt!: string;
}
