import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaginationDto } from '@/common/dto/pagination.dto';

import type { PlanGoalSummary, PlanListItem } from '../plans/plan-list.service';
import type { GoalTargetSummary } from '../plans/plan-presentation';
import type { PlanStats } from '../plans/plan-stats.service';
import {
  MANUAL_PLAN_MAX_DISTANCE_KM,
  MANUAL_PLAN_MAX_DURATION_MINUTES,
  MANUAL_PLAN_MIN_DURATION_MINUTES,
  PLAN_CHANGE_KINDS,
  PLAN_CHANGE_MAX_OPERATIONS,
  PLAN_LIST_GROUPS,
  PLAN_NAME_MAX_LENGTH,
  PLAN_NOTES_MAX_LENGTH,
  PlanListGroup,
  TRAINING_PLAN_STATUSES,
  type TrainingPlanStatus,
  WORKOUT_OPERATION_KINDS,
  WORKOUT_TYPES,
} from '../training.constants';
import { PlanDiffDto, PlanListMetaDto } from './plan-shapes.dto';

// --------------------------------------------------------------------- list

export class PlanListQueryDto extends PaginationDto {
  @ApiProperty({ enum: PLAN_LIST_GROUPS })
  @IsIn(PLAN_LIST_GROUPS as unknown as string[])
  group!: PlanListGroup;

  @ApiPropertyOptional({ maximum: 50, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  @IsOptional()
  limit?: number = 20;
}

export class GoalTargetSummaryDto implements GoalTargetSummary {
  @ApiProperty({ type: Number, nullable: true })
  distanceMeters!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  finishTimeSec!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  runsPerWeek!: number | null;

  @ApiProperty({ type: Number, nullable: true })
  weightKg!: number | null;
}

/** Goal as codes and numbers; the apps build its title in the app language. */
export class PlanGoalSummaryDto implements PlanGoalSummary {
  @ApiProperty({ type: String, nullable: true, description: 'Goal type code' })
  type!: string | null;

  @ApiProperty({ type: GoalTargetSummaryDto, nullable: true })
  target!: GoalTargetSummaryDto | null;

  @ApiProperty({ type: String, nullable: true, description: "User's own text of a custom goal" })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true })
  targetDate!: string | null;
}

export class PlanStatsDto implements PlanStats {
  @ApiProperty()
  completedWorkouts!: number;

  @ApiProperty()
  plannedWorkouts!: number;

  @ApiProperty()
  completionRate!: number;

  @ApiProperty()
  totalDistanceKm!: number;
}

export class PlanListItemDto implements PlanListItem {
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

  @ApiProperty({ type: PlanStatsDto, nullable: true })
  stats!: PlanStatsDto | null;

  @ApiProperty({ type: String, nullable: true })
  notesPreview!: string | null;

  @ApiProperty({ type: String, nullable: true })
  sourcePlanId!: string | null;

  @ApiPropertyOptional()
  metricsStale?: boolean;

  @ApiPropertyOptional()
  currentWeek?: number;

  @ApiPropertyOptional()
  progress?: number;

  @ApiProperty()
  updatedAt!: string;
}

export class PlanListResponseDto {
  @ApiProperty({ type: [PlanListItemDto] })
  items!: PlanListItemDto[];

  @ApiProperty({ type: PlanListMetaDto })
  meta!: PlanListMetaDto;
}

export class PlanCountsResponseDto {
  @ApiProperty()
  draft!: number;

  @ApiProperty()
  active!: number;

  @ApiProperty()
  history!: number;
}

// --------------------------------------------------------------------- meta

export class UpdatePlanMetaDto {
  @ApiPropertyOptional({ maxLength: PLAN_NAME_MAX_LENGTH })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(PLAN_NAME_MAX_LENGTH)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: PLAN_NOTES_MAX_LENGTH })
  @IsString()
  @MaxLength(PLAN_NOTES_MAX_LENGTH)
  @IsOptional()
  notes?: string | null;

  @ApiProperty({ description: 'Optimistic-locking version of the plan known to the client' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;
}

// ---------------------------------------------------------------- structure

export class DraftWorkoutOverrideDto {
  @ApiProperty()
  @IsString()
  key!: string;

  @ApiPropertyOptional({ enum: WORKOUT_TYPES })
  @IsIn(WORKOUT_TYPES as unknown as string[])
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'Weekday index (0 = Monday)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  dayOfWeek?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MANUAL_PLAN_MAX_DISTANCE_KM })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MANUAL_PLAN_MAX_DISTANCE_KM)
  @IsOptional()
  distanceKm?: number;

  @ApiPropertyOptional({ minimum: MANUAL_PLAN_MIN_DURATION_MINUTES, maximum: MANUAL_PLAN_MAX_DURATION_MINUTES })
  @Type(() => Number)
  @IsInt()
  @Min(MANUAL_PLAN_MIN_DURATION_MINUTES)
  @Max(MANUAL_PLAN_MAX_DURATION_MINUTES)
  @IsOptional()
  durationMinutes?: number;
}

export class DraftNewWorkoutDto {
  @ApiProperty({ enum: WORKOUT_TYPES })
  @IsIn(WORKOUT_TYPES as unknown as string[])
  type!: string;

  @ApiProperty({ description: 'Weekday index (0 = Monday)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ minimum: MANUAL_PLAN_MIN_DURATION_MINUTES, maximum: MANUAL_PLAN_MAX_DURATION_MINUTES })
  @Type(() => Number)
  @IsInt()
  @Min(MANUAL_PLAN_MIN_DURATION_MINUTES)
  @Max(MANUAL_PLAN_MAX_DURATION_MINUTES)
  durationMinutes!: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MANUAL_PLAN_MAX_DISTANCE_KM })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MANUAL_PLAN_MAX_DISTANCE_KM)
  @IsOptional()
  distanceKm?: number;
}

export class DraftWeekOverrideDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  weekNumber!: number;

  @ApiPropertyOptional({ type: [DraftWorkoutOverrideDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftWorkoutOverrideDto)
  @IsOptional()
  workoutOverrides?: DraftWorkoutOverrideDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  removedWorkoutKeys?: string[];

  @ApiPropertyOptional({ type: [DraftNewWorkoutDto] })
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => DraftNewWorkoutDto)
  @IsOptional()
  newWorkouts?: DraftNewWorkoutDto[];
}

export class UpdatePlanStructureDto {
  @ApiProperty({ description: 'Optimistic-locking version of the plan known to the client' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @ApiProperty({ type: [DraftWeekOverrideDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DraftWeekOverrideDto)
  weekOverrides!: DraftWeekOverrideDto[];
}

// -------------------------------------------------------------------- start

export class StartOptionsQueryDto {
  @ApiPropertyOptional({ example: 'Europe/Moscow', description: 'IANA timezone of the athlete' })
  @IsTimeZone()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ example: '2027-09-19' })
  @IsDateString()
  @IsOptional()
  goalTargetDate?: string;
}

export class StartPlanDto {
  @ApiProperty({ example: '2027-06-01' })
  @IsDateString()
  startDate!: string;

  @ApiPropertyOptional({ example: '2027-09-19' })
  @IsDateString()
  @IsOptional()
  goalTargetDate?: string;

  @ApiProperty({ description: 'Must be true when another plan is already active' })
  @IsBoolean()
  replaceActive!: boolean;

  @ApiPropertyOptional({ example: 'Europe/Moscow', description: 'IANA timezone of the athlete' })
  @IsTimeZone()
  @IsOptional()
  timezone?: string;
}

export class TimezoneQueryDto {
  @ApiPropertyOptional({ example: 'Europe/Moscow', description: 'IANA timezone of the athlete' })
  @IsTimeZone()
  @IsOptional()
  timezone?: string;
}

export class CancelPlanDto {
  @ApiPropertyOptional({ example: 'Europe/Moscow', description: 'IANA timezone of the athlete' })
  @IsTimeZone()
  @IsOptional()
  timezone?: string;
}

export class CancelPlanResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  cancelledWorkouts!: number;
}

// ------------------------------------------------------------------ changes

export class WorkoutOperationDto {
  @ApiProperty({ enum: WORKOUT_OPERATION_KINDS })
  @IsIn(WORKOUT_OPERATION_KINDS as unknown as string[])
  op!: (typeof WORKOUT_OPERATION_KINDS)[number];

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  workoutId?: string;

  @ApiPropertyOptional({ example: '2027-07-03' })
  @IsDateString()
  @IsOptional()
  date?: string;

  @ApiPropertyOptional({ enum: WORKOUT_TYPES })
  @IsIn(WORKOUT_TYPES as unknown as string[])
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: MANUAL_PLAN_MAX_DISTANCE_KM })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MANUAL_PLAN_MAX_DISTANCE_KM)
  @IsOptional()
  distanceKm?: number;

  @ApiPropertyOptional({ minimum: MANUAL_PLAN_MIN_DURATION_MINUTES, maximum: MANUAL_PLAN_MAX_DURATION_MINUTES })
  @Type(() => Number)
  @IsInt()
  @Min(MANUAL_PLAN_MIN_DURATION_MINUTES)
  @Max(MANUAL_PLAN_MAX_DURATION_MINUTES)
  @IsOptional()
  durationMinutes?: number;
}

export class PlanScheduleDto {
  @ApiProperty({ description: 'Training days as weekday indexes (0 = Monday)', type: [Number] })
  @IsArray()
  @ArrayMaxSize(7)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(6, { each: true })
  trainingDays!: number[];

  @ApiPropertyOptional({ description: 'Preferred long run day (0 = Monday)' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(6)
  @IsOptional()
  preferredLongRunDay?: number;

  @ApiPropertyOptional({ minimum: MANUAL_PLAN_MIN_DURATION_MINUTES, maximum: MANUAL_PLAN_MAX_DURATION_MINUTES })
  @Type(() => Number)
  @IsInt()
  @Min(MANUAL_PLAN_MIN_DURATION_MINUTES)
  @Max(MANUAL_PLAN_MAX_DURATION_MINUTES)
  @IsOptional()
  workoutDurationMinutes?: number;
}

export class PlanChangesDto {
  @ApiProperty({ enum: PLAN_CHANGE_KINDS })
  @IsIn(PLAN_CHANGE_KINDS as unknown as string[])
  kind!: (typeof PLAN_CHANGE_KINDS)[number];

  @ApiProperty({ description: 'Optimistic-locking version of the plan known to the client' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  expectedVersion!: number;

  @ApiPropertyOptional({ example: 'Europe/Moscow', description: 'IANA timezone of the athlete' })
  @IsTimeZone()
  @IsOptional()
  timezone?: string;

  @ApiPropertyOptional({ type: [WorkoutOperationDto], maxItems: PLAN_CHANGE_MAX_OPERATIONS })
  @IsArray()
  @ArrayMaxSize(PLAN_CHANGE_MAX_OPERATIONS)
  @ValidateNested({ each: true })
  @Type(() => WorkoutOperationDto)
  @IsOptional()
  operations?: WorkoutOperationDto[];

  @ApiPropertyOptional({ type: PlanScheduleDto })
  @ValidateNested()
  @Type(() => PlanScheduleDto)
  @IsOptional()
  schedule?: PlanScheduleDto;

  @ApiPropertyOptional({ enum: ['next_week', 'tomorrow'] })
  @IsIn(['next_week', 'tomorrow'])
  @IsOptional()
  effectiveFrom?: 'next_week' | 'tomorrow';

  @ApiPropertyOptional({ example: '2027-10-03' })
  @IsDateString()
  @IsOptional()
  goalTargetDate?: string;
}

export class PlanChangesPreviewResponseDto {
  @ApiProperty({ type: PlanDiffDto })
  diff!: Record<string, unknown>;

  @ApiProperty({ type: [String] })
  warnings!: string[];

  @ApiProperty({ type: String, nullable: true })
  resultingEndDate!: string | null;

  @ApiProperty()
  version!: number;
}

// ---------------------------------------------------------------- responses

export class ActivePlanSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'User-given name; null means the app titles the plan by its goal',
  })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  startDate!: string | null;

  @ApiProperty({ type: String, nullable: true })
  endDate!: string | null;

  @ApiProperty()
  currentWeek!: number;

  @ApiProperty()
  totalWeeks!: number;

  @ApiProperty()
  completedWorkouts!: number;

  @ApiProperty()
  futurePlannedWorkouts!: number;
}

export class ActivePlanResponseDto {
  @ApiProperty({ type: ActivePlanSummaryDto, nullable: true })
  plan!: ActivePlanSummaryDto | null;
}

export class StartOptionDto {
  @ApiProperty({ enum: ['today', 'next_monday', 'race_aligned'] })
  kind!: 'today' | 'next_monday' | 'race_aligned';

  @ApiProperty()
  startDate!: string;

  @ApiProperty()
  endDate!: string;

  @ApiPropertyOptional()
  goalTargetDate?: string;

  @ApiPropertyOptional({ description: 'race_aligned only: whether the plan fits before the target date' })
  fits?: boolean;

  @ApiPropertyOptional({ description: 'race_aligned only: weeks left until the target date when it does not fit' })
  weeksAvailable?: number;

  @ApiPropertyOptional({ enum: ['target_date_passed'] })
  reason?: 'target_date_passed';
}

export class StartOptionsResponseDto {
  @ApiProperty()
  today!: string;

  @ApiProperty()
  totalWeeks!: number;

  @ApiProperty({ type: [StartOptionDto] })
  options!: StartOptionDto[];

  @ApiProperty({ enum: ['today', 'next_monday', 'race_aligned'] })
  recommended!: 'today' | 'next_monday' | 'race_aligned';

  @ApiProperty()
  metricsStale!: boolean;

  @ApiProperty({ type: ActivePlanSummaryDto, nullable: true })
  activePlan!: ActivePlanSummaryDto | null;
}

export class PlanMetaResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'User-given name; null means the app titles the plan by its goal',
  })
  name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty()
  version!: number;
}

export class PlanVersionResponseDto {
  @ApiProperty()
  version!: number;
}
