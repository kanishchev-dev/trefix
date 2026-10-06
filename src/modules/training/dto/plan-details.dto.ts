import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Plan details; `weeks` are relative for drafts and dated otherwise. */
export class PlanDetailsDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  creationSource!: string;

  @ApiProperty({ type: Object })
  goal!: Record<string, unknown>;

  @ApiProperty()
  totalWeeks!: number;

  @ApiPropertyOptional()
  sessionsPerWeek?: number | null;

  @ApiPropertyOptional()
  startDate?: string | null;

  @ApiPropertyOptional()
  endDate?: string | null;

  @ApiPropertyOptional()
  cancelledAt?: string | null;

  @ApiPropertyOptional()
  cancelReason?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty()
  version!: number;

  @ApiProperty({ type: Object })
  config!: Record<string, unknown>;

  @ApiPropertyOptional({ type: Object })
  metricsSnapshot?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  sourcePlanId?: string | null;

  @ApiPropertyOptional({ type: Object })
  stats?: Record<string, unknown> | null;

  @ApiPropertyOptional()
  metricsStale?: boolean;

  @ApiPropertyOptional({ description: 'Active plans only' })
  currentWeek?: number;

  @ApiPropertyOptional({ description: 'Active plans only, 0..1' })
  progress?: number;

  @ApiPropertyOptional({ nullable: true })
  replacedByPlanId?: string | null;

  @ApiProperty({ type: [Object], description: 'Dated plans: planned and actual workouts (cancelled excluded)' })
  workouts!: Array<Record<string, unknown>>;

  @ApiProperty({ type: [Object] })
  weeks!: Array<Record<string, unknown>>;

  @ApiProperty()
  updatedAt!: string;
}
