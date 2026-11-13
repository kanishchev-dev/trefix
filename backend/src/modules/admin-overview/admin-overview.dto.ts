import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsTimeZone } from 'class-validator';

import { USER_STATUSES, type UserStatus } from '@/modules/users/user-status';

export class AdminOverviewQueryDto {
  @ApiPropertyOptional({
    example: 'Europe/Moscow',
    description: 'IANA timezone of "today" and "this week"; UTC when omitted',
  })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}

export class OverviewSessionDto {
  @ApiProperty({ format: 'date-time' })
  lastActiveAt!: string;

  @ApiProperty({ type: String, nullable: true, example: 'ios' })
  platform!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '1.4.2' })
  appVersion!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'iPhone 15 Pro' })
  deviceName!: string | null;
}

export class OverviewActivePlanDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;

  @ApiProperty({ example: 6, description: '1-based week of the plan that contains today' })
  currentWeek!: number;

  @ApiProperty({ example: 14 })
  totalWeeks!: number;

  @ApiProperty({ type: String, nullable: true, example: '2027-04-20' })
  endDate!: string | null;
}

export class OverviewWeekDto {
  @ApiProperty({ example: '2026-10-12', description: 'Monday of the current week' })
  from!: string;

  @ApiProperty({ example: 32 })
  plannedKm!: number;

  @ApiProperty({ example: 24.3 })
  doneKm!: number;

  @ApiProperty({ example: 4 })
  plannedWorkouts!: number;

  @ApiProperty({ example: 3 })
  doneWorkouts!: number;
}

export class OverviewWorkoutDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  scheduledAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ example: 'easy' })
  type!: string;

  @ApiProperty({ example: 'run', description: 'run | walk | hike | strength' })
  sport!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Title the user or admin gave; clients name the type otherwise',
  })
  title!: string | null;

  @ApiProperty({ example: 'planned' })
  status!: string;

  @ApiProperty({ example: 8, description: 'Planned distance, km' })
  distanceKm!: number;

  @ApiProperty({ type: Number, nullable: true, example: 8.4, description: 'Actual distance, km' })
  actualDistanceKm!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 312 })
  actualPaceSecondsPerKm!: number | null;
}

export const OVERVIEW_ATTENTION_CODES = [
  'adaptation_pending',
  'missed_workouts',
  'gear_replace_soon',
  'integration_error',
] as const;

export class OverviewAttentionDto {
  @ApiProperty({ enum: OVERVIEW_ATTENTION_CODES })
  code!: (typeof OVERVIEW_ATTENTION_CODES)[number];

  @ApiPropertyOptional({ description: 'Adaptation or gear id' })
  entityId?: string;

  @ApiPropertyOptional({ example: 2 })
  count?: number;

  @ApiPropertyOptional({ example: 14 })
  days?: number;

  @ApiPropertyOptional({ example: 'Nike Pegasus 40' })
  name?: string;

  @ApiPropertyOptional({ example: 742 })
  distanceKm?: number;

  @ApiPropertyOptional({ example: 800 })
  limitKm?: number;

  @ApiPropertyOptional({ example: 'strava' })
  provider?: string;

  @ApiPropertyOptional({ example: 'error' })
  status?: string;
}

export class OverviewConnectionDto {
  @ApiProperty({ example: 'strava', description: 'Integration provider or `coach`' })
  key!: string;

  @ApiProperty({ example: 'connected', description: 'Integration status, or `enabled` / `disabled` for the coach' })
  status!: string;
}

export class AdminOverviewResponseDto {
  @ApiProperty({ enum: USER_STATUSES })
  status!: UserStatus;

  @ApiProperty({ type: () => OverviewSessionDto, nullable: true })
  lastSession!: OverviewSessionDto | null;

  @ApiProperty({ description: 'False when the user never set up the athlete profile; training blocks are then empty' })
  hasAthlete!: boolean;

  @ApiProperty({ type: () => OverviewActivePlanDto, nullable: true })
  activePlan!: OverviewActivePlanDto | null;

  @ApiProperty({ type: () => OverviewWeekDto, nullable: true })
  week!: OverviewWeekDto | null;

  @ApiProperty({ type: () => OverviewWorkoutDto, nullable: true })
  lastWorkout!: OverviewWorkoutDto | null;

  @ApiProperty({ type: () => OverviewWorkoutDto, isArray: true })
  upcomingWorkouts!: OverviewWorkoutDto[];

  @ApiProperty({ type: () => OverviewAttentionDto, isArray: true })
  attention!: OverviewAttentionDto[];

  @ApiProperty({ type: () => OverviewConnectionDto, isArray: true })
  connections!: OverviewConnectionDto[];
}
