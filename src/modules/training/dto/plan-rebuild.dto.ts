import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsTimeZone,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PLAN_NAME_MAX_LENGTH, PLAN_NOTES_MAX_LENGTH } from '../training.constants';
import { ManualPlanGoalDto, ManualPlanScheduleDto, ManualPlanStructureDto } from './create-manual-plan.dto';
import { DraftWeekOverrideDto } from './plan-lifecycle.dto';
import { AthleteMetricsDto, PlanStartBlockDto } from './plan-metrics.dto';

export const REBUILD_TARGETS = ['new_draft', 'in_place'] as const;

export class RebuildPrefillQueryDto {
  @ApiPropertyOptional({ example: 'Europe/Moscow' })
  @IsTimeZone()
  @IsOptional()
  timezone?: string;
}

/** Parameters of a rebuild: the same steps as plan creation plus current metrics. */
export class RebuildPreviewRequestDto {
  @ApiProperty({ type: ManualPlanGoalDto })
  @ValidateNested()
  @Type(() => ManualPlanGoalDto)
  goal!: ManualPlanGoalDto;

  @ApiProperty({ type: ManualPlanScheduleDto })
  @ValidateNested()
  @Type(() => ManualPlanScheduleDto)
  schedule!: ManualPlanScheduleDto;

  @ApiProperty({ type: ManualPlanStructureDto })
  @ValidateNested()
  @Type(() => ManualPlanStructureDto)
  structure!: ManualPlanStructureDto;

  @ApiProperty({ type: AthleteMetricsDto })
  @ValidateNested()
  @Type(() => AthleteMetricsDto)
  metrics!: AthleteMetricsDto;

  @ApiProperty({
    enum: REBUILD_TARGETS,
    description: '`new_draft` creates a new plan from a history plan; `in_place` updates a draft',
  })
  @IsIn(REBUILD_TARGETS as unknown as string[])
  target!: (typeof REBUILD_TARGETS)[number];

  @ApiPropertyOptional({ example: 'Europe/Moscow', description: 'IANA timezone used for the start options' })
  @IsTimeZone()
  @IsOptional()
  timezone?: string;
}

export class RebuildRequestDto extends RebuildPreviewRequestDto {
  @ApiPropertyOptional({ type: [DraftWeekOverrideDto], description: 'Manual edits of the previewed weeks, by key' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftWeekOverrideDto)
  @IsOptional()
  weekOverrides?: DraftWeekOverrideDto[];

  @ApiPropertyOptional({ description: 'Required for `in_place`: the draft version the client edited' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  expectedVersion?: number;

  @ApiPropertyOptional({ maxLength: PLAN_NAME_MAX_LENGTH, description: 'Defaults to "<source name> <year>"' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(PLAN_NAME_MAX_LENGTH)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: PLAN_NOTES_MAX_LENGTH })
  @IsString()
  @MaxLength(PLAN_NOTES_MAX_LENGTH)
  @IsOptional()
  notes?: string | null;

  @ApiPropertyOptional({ description: 'Keep the rebuilt plan as a draft' })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  saveAsDraft?: boolean;

  @ApiPropertyOptional({ type: PlanStartBlockDto, description: 'Start the rebuilt plan in the same transaction' })
  @ValidateNested()
  @Type(() => PlanStartBlockDto)
  @IsOptional()
  start?: PlanStartBlockDto;
}

export class RebuildPreviewResponseDto {
  @ApiProperty({ enum: ['rebased', 'regenerated'] })
  mode!: 'rebased' | 'regenerated';

  @ApiProperty({ type: [Object], description: 'Relative weeks (week number, weekday) with stable workout keys' })
  weeks!: Array<Record<string, unknown>>;

  @ApiProperty({
    type: Object,
    description: 'Dated preview in the manual preview format, starting at the recommended date',
  })
  preview!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  diff!: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  warnings!: string[];

  @ApiProperty({ type: Object })
  startOptions!: Record<string, unknown>;
}

export class RebuildPrefillMetricsDto {
  @ApiPropertyOptional({ type: Object, nullable: true, description: 'Metrics captured at the source plan start' })
  previous?: Record<string, unknown> | null;

  @ApiProperty({ type: Object, description: 'Current metrics estimate with per-field sources' })
  current!: Record<string, unknown>;
}

export class RebuildPrefillResponseDto {
  @ApiProperty({ type: Object })
  config!: Record<string, unknown>;

  @ApiProperty({ type: Object })
  goalSuggestion!: Record<string, unknown>;

  @ApiProperty({ type: RebuildPrefillMetricsDto })
  metrics!: RebuildPrefillMetricsDto;
}
