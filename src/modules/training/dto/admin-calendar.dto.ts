import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  ADMIN_CALENDAR_DAY_MAX_WORKOUTS,
  ADMIN_CALENDAR_SUMMARY_MAX_DAYS,
  ADMIN_WORKOUT_EDITABLE_STATUSES,
  ADMIN_WORKOUT_FIELD_RANGES,
  AdminWorkoutEditableStatus,
} from '../admin-calendar.constants';
import { WORKOUT_STATUSES, WORKOUT_TYPES, WorkoutStatus, WorkoutType } from '../training.constants';

/** Calendar day without time, as the admin picks it in the date picker. */
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const trimString = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

/** Shared timezone parameter: the backend resolves day boundaries in this zone. */
class AdminCalendarTimezoneQueryDto {
  @ApiPropertyOptional({
    example: 'Europe/Moscow',
    description: 'IANA timezone used to resolve local day boundaries; UTC when omitted',
  })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}

export class AdminCalendarDayQueryDto extends AdminCalendarTimezoneQueryDto {
  @ApiProperty({ example: '2026-10-06', description: 'Local calendar day (YYYY-MM-DD)' })
  @Matches(DATE_KEY_PATTERN)
  @IsISO8601({ strict: true })
  date!: string;
}

export class AdminCalendarSummaryQueryDto extends AdminCalendarTimezoneQueryDto {
  @ApiProperty({ example: '2026-09-28', description: 'First local day of the range (YYYY-MM-DD), inclusive' })
  @Matches(DATE_KEY_PATTERN)
  @IsISO8601({ strict: true })
  from!: string;

  @ApiProperty({
    example: '2026-11-08',
    description: `Last local day of the range (YYYY-MM-DD), inclusive; at most ${ADMIN_CALENDAR_SUMMARY_MAX_DAYS} days`,
  })
  @Matches(DATE_KEY_PATTERN)
  @IsISO8601({ strict: true })
  to!: string;
}

export class AdminWorkoutCreateDto {
  @ApiProperty({
    example: '2026-10-06T06:00:00.000Z',
    description: 'Workout start moment (UTC instant); past dates allowed',
  })
  @IsISO8601({ strict: true })
  scheduledAt!: string;

  @ApiProperty({ enum: WORKOUT_TYPES, example: 'easy' })
  @IsIn(WORKOUT_TYPES)
  type!: WorkoutType;

  @ApiPropertyOptional({
    minimum: ADMIN_WORKOUT_FIELD_RANGES.durationMinutes.min,
    maximum: ADMIN_WORKOUT_FIELD_RANGES.durationMinutes.max,
    description: 'Planned duration in minutes; defaults to 30',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(ADMIN_WORKOUT_FIELD_RANGES.durationMinutes.min)
  @Max(ADMIN_WORKOUT_FIELD_RANGES.durationMinutes.max)
  durationMinutes?: number;

  @ApiPropertyOptional({
    minimum: ADMIN_WORKOUT_FIELD_RANGES.distanceKm.min,
    maximum: ADMIN_WORKOUT_FIELD_RANGES.distanceKm.max,
    description: 'Planned distance in kilometres; defaults to 5',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(ADMIN_WORKOUT_FIELD_RANGES.distanceKm.min)
  @Max(ADMIN_WORKOUT_FIELD_RANGES.distanceKm.max)
  distanceKm?: number;

  @ApiPropertyOptional({
    enum: ADMIN_WORKOUT_EDITABLE_STATUSES,
    default: 'planned',
    description: 'Completed workouts are logged by the athlete together with the actual result',
  })
  @IsOptional()
  @IsIn(ADMIN_WORKOUT_EDITABLE_STATUSES)
  status?: AdminWorkoutEditableStatus;

  @ApiPropertyOptional({
    maxLength: ADMIN_WORKOUT_FIELD_RANGES.titleMaxLength,
    description: 'Title shown in the athlete calendar; derived from the type when omitted',
  })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(ADMIN_WORKOUT_FIELD_RANGES.titleMaxLength)
  title?: string;
}

export class AdminWorkoutUpdateDto {
  @ApiPropertyOptional({ example: '2026-10-06T07:30:00.000Z', description: 'New start moment (UTC instant)' })
  @IsOptional()
  @IsISO8601({ strict: true })
  scheduledAt?: string;

  @ApiPropertyOptional({ enum: WORKOUT_TYPES })
  @IsOptional()
  @IsIn(WORKOUT_TYPES)
  type?: WorkoutType;

  @ApiPropertyOptional({
    minimum: ADMIN_WORKOUT_FIELD_RANGES.durationMinutes.min,
    maximum: ADMIN_WORKOUT_FIELD_RANGES.durationMinutes.max,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(ADMIN_WORKOUT_FIELD_RANGES.durationMinutes.min)
  @Max(ADMIN_WORKOUT_FIELD_RANGES.durationMinutes.max)
  durationMinutes?: number;

  @ApiPropertyOptional({
    minimum: ADMIN_WORKOUT_FIELD_RANGES.distanceKm.min,
    maximum: ADMIN_WORKOUT_FIELD_RANGES.distanceKm.max,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(ADMIN_WORKOUT_FIELD_RANGES.distanceKm.min)
  @Max(ADMIN_WORKOUT_FIELD_RANGES.distanceKm.max)
  distanceKm?: number;

  @ApiPropertyOptional({ enum: ADMIN_WORKOUT_EDITABLE_STATUSES })
  @IsOptional()
  @IsIn(ADMIN_WORKOUT_EDITABLE_STATUSES)
  status?: AdminWorkoutEditableStatus;

  @ApiPropertyOptional({ maxLength: ADMIN_WORKOUT_FIELD_RANGES.titleMaxLength })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(ADMIN_WORKOUT_FIELD_RANGES.titleMaxLength)
  title?: string;
}

export class AdminWorkoutResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  athleteId!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Owning plan; null for standalone workouts' })
  planId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  scheduledAt!: Date;

  @ApiProperty({ enum: WORKOUT_TYPES })
  type!: WorkoutType;

  @ApiProperty({ example: 'base', description: 'Training phase; `adhoc` for workouts outside of a plan' })
  phase!: string;

  @ApiProperty({ enum: WORKOUT_STATUSES })
  status!: WorkoutStatus;

  @ApiProperty({ example: 40 })
  durationMinutes!: number;

  @ApiProperty({ example: 6 })
  distanceKm!: number;

  @ApiPropertyOptional({ nullable: true, description: 'Title shown in the athlete calendar' })
  title!: string | null;

  @ApiPropertyOptional({ nullable: true, description: 'Where the workout came from: plan, manual, strava, admin…' })
  source!: string | null;

  @ApiProperty({ description: 'Whether the workout carries an actual result (immutable history)' })
  hasActual!: boolean;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: Date;
}

export class AdminCalendarDayResponseDto {
  @ApiProperty({ example: '2026-10-06', description: 'Requested local calendar day' })
  date!: string;

  @ApiProperty({ example: 'Europe/Moscow', description: 'Timezone the day boundaries were resolved in' })
  timezone!: string;

  @ApiProperty({ type: [AdminWorkoutResponseDto], maxItems: ADMIN_CALENDAR_DAY_MAX_WORKOUTS })
  workouts!: AdminWorkoutResponseDto[];

  @ApiProperty({ example: 2, description: 'Number of returned workouts' })
  total!: number;

  @ApiProperty({ description: 'False when the user has no athlete profile yet: the calendar is read-only' })
  hasAthleteProfile!: boolean;
}

export class AdminCalendarSummaryDayDto {
  @ApiProperty({ example: '2026-10-06', description: 'Local calendar day' })
  date!: string;

  @ApiProperty({ example: 2 })
  total!: number;

  @ApiProperty({
    example: { planned: 1, completed: 1, skipped: 0, cancelled: 0 },
    description: 'Workout count per status',
  })
  statuses!: Record<WorkoutStatus, number>;
}

export class AdminCalendarSummaryResponseDto {
  @ApiProperty({ example: '2026-09-28' })
  from!: string;

  @ApiProperty({ example: '2026-11-08' })
  to!: string;

  @ApiProperty({ example: 'Europe/Moscow' })
  timezone!: string;

  @ApiProperty({ type: [AdminCalendarSummaryDayDto], description: 'Only days that have workouts, ascending' })
  days!: AdminCalendarSummaryDayDto[];
}

export class AdminWorkoutMutationResponseDto {
  @ApiProperty({ type: AdminWorkoutResponseDto })
  workout!: AdminWorkoutResponseDto;
}
