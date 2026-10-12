import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { WORKOUT_TYPES, type WorkoutType } from '../../../training/training.constants';
import {
  DISTANCE_SOURCES,
  type DistanceSource,
  RECORDING_ENVIRONMENTS,
  RECORDING_LIMITS,
  type RecordingEnvironment,
} from '../../constants/integrations.constants';

export class RecordedSplitDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(1)
  km!: number;

  @ApiProperty({ example: 301 })
  @IsInt()
  @Min(0)
  durationSec!: number;

  @ApiProperty({ example: 301 })
  @IsInt()
  @Min(0)
  paceSecPerKm!: number;

  @ApiPropertyOptional({ example: 6, nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  elevationGainM?: number | null;

  @ApiPropertyOptional({ example: 148, nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(250)
  avgHeartRate?: number | null;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  partial?: boolean;
}

export class RecordedLapDto {
  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  index!: number;

  @ApiProperty({ example: 'work' })
  @IsString()
  @MaxLength(16)
  kind!: string;

  @ApiPropertyOptional({ example: 300, nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  plannedSec?: number | null;

  @ApiPropertyOptional({ example: null, nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  plannedM?: number | null;

  @ApiProperty({ example: 300 })
  @IsInt()
  @Min(0)
  actualSec!: number;

  @ApiProperty({ example: 1050 })
  @IsInt()
  @Min(0)
  actualM!: number;

  @ApiPropertyOptional({ example: 286, nullable: true, type: Number })
  @IsOptional()
  @IsInt()
  @Min(0)
  avgPaceSecPerKm?: number | null;

  @ApiPropertyOptional({ example: true, nullable: true, type: Boolean })
  @IsOptional()
  @IsBoolean()
  inTarget?: boolean | null;
}

export class RecordedPauseDto {
  @ApiProperty({ example: '2026-10-10T06:41:12Z' })
  @IsISO8601()
  startedAt!: string;

  @ApiProperty({ example: '2026-10-10T06:41:40Z' })
  @IsISO8601()
  endedAt!: string;

  @ApiProperty({ example: true })
  @IsBoolean()
  auto!: boolean;
}

export class RouteBoundsDto {
  @ApiProperty() @IsLatitude() minLat!: number;
  @ApiProperty() @IsLongitude() minLng!: number;
  @ApiProperty() @IsLatitude() maxLat!: number;
  @ApiProperty() @IsLongitude() maxLng!: number;
}

export class RoutePointDto {
  @ApiProperty() @IsLatitude() lat!: number;
  @ApiProperty() @IsLongitude() lng!: number;
}

export class RecordingDeviceDto {
  @ApiProperty({ example: 'ios' })
  @IsIn(['ios', 'android'])
  platform!: string;

  @ApiPropertyOptional({ example: '26.0' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  osVersion?: string;

  @ApiPropertyOptional({ example: '1.4.0' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string;

  @ApiPropertyOptional({ example: 'iPhone16,2' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  model?: string;
}

/** Summary of a run recorded in the app; the `summary` field of the multipart request. */
export class RecordedActivityDto {
  @ApiProperty({ format: 'uuid', description: 'Recording session id on the phone; repeats return the stored result' })
  @IsUUID()
  clientSessionId!: string;

  @ApiProperty({ enum: RECORDING_ENVIRONMENTS })
  @IsIn(RECORDING_ENVIRONMENTS)
  environment!: RecordingEnvironment;

  @ApiProperty({ enum: DISTANCE_SOURCES })
  @IsIn(DISTANCE_SOURCES)
  distanceSource!: DistanceSource;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  plannedWorkoutId?: string | null;

  @ApiPropertyOptional({ enum: WORKOUT_TYPES, nullable: true, description: 'Type of a free run' })
  @IsOptional()
  @IsIn(WORKOUT_TYPES.filter((type) => type !== 'rest'))
  workoutType?: WorkoutType | null;

  @ApiProperty({ example: '2026-10-10T06:30:00Z' })
  @IsISO8601()
  startedAt!: string;

  @ApiProperty({ example: '2026-10-10T07:22:10Z' })
  @IsISO8601()
  endedAt!: string;

  @ApiPropertyOptional({ example: 180 })
  @IsOptional()
  @IsInt()
  @Min(-720)
  @Max(840)
  utcOffsetMinutes?: number;

  @ApiProperty({ example: 3130 })
  @IsInt()
  @Min(1)
  @Max(RECORDING_LIMITS.maxDurationSec)
  elapsedSec!: number;

  @ApiProperty({ example: 3012 })
  @IsInt()
  @Min(1)
  @Max(RECORDING_LIMITS.maxDurationSec)
  movingSec!: number;

  @ApiProperty({ example: 10040, description: 'Final distance, after a correction on the finish screen' })
  @IsInt()
  @Min(0)
  @Max(RECORDING_LIMITS.maxDistanceM)
  distanceM!: number;

  @ApiPropertyOptional({
    example: 10040,
    description: 'Distance the phone measured before the correction',
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(RECORDING_LIMITS.maxDistanceM)
  measuredDistanceM?: number | null;

  @ApiPropertyOptional({ example: 64, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20_000)
  elevationGainM?: number | null;

  @ApiPropertyOptional({ example: 61, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20_000)
  elevationLossM?: number | null;

  @ApiPropertyOptional({ example: 300, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  avgPaceSecPerKm?: number | null;

  @ApiPropertyOptional({ example: 271, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  bestPaceSecPerKm?: number | null;

  @ApiPropertyOptional({ example: 148, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(250)
  avgHeartRate?: number | null;

  @ApiPropertyOptional({ example: 171, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(250)
  maxHeartRate?: number | null;

  @ApiPropertyOptional({ example: 172, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(300)
  avgCadence?: number | null;

  @ApiPropertyOptional({ type: [RecordedSplitDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(RECORDING_LIMITS.maxSplits)
  @ValidateNested({ each: true })
  @Type(() => RecordedSplitDto)
  splits?: RecordedSplitDto[];

  @ApiPropertyOptional({ type: [RecordedLapDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(RECORDING_LIMITS.maxLaps)
  @ValidateNested({ each: true })
  @Type(() => RecordedLapDto)
  laps?: RecordedLapDto[];

  @ApiPropertyOptional({ type: [RecordedPauseDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(RECORDING_LIMITS.maxPauses)
  @ValidateNested({ each: true })
  @Type(() => RecordedPauseDto)
  pauses?: RecordedPauseDto[];

  @ApiPropertyOptional({ description: 'Encoded polyline (precision 5), up to 500 points', nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(RECORDING_LIMITS.maxRouteLineLength)
  routeLine?: string | null;

  @ApiPropertyOptional({ type: RouteBoundsDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RouteBoundsDto)
  routeBounds?: RouteBoundsDto | null;

  @ApiPropertyOptional({ type: RoutePointDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => RoutePointDto)
  startPoint?: RoutePointDto | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, type: String })
  @IsOptional()
  @IsUUID()
  gearId?: string | null;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  feeling?: number | null;

  @ApiPropertyOptional({ example: 6, minimum: 1, maximum: 10, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  rpe?: number | null;

  @ApiPropertyOptional({ maxLength: RECORDING_LIMITS.maxNotesLength, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(RECORDING_LIMITS.maxNotesLength)
  notes?: string | null;

  @ApiProperty({ type: RecordingDeviceDto })
  @ValidateNested()
  @Type(() => RecordingDeviceDto)
  device!: RecordingDeviceDto;
}

export const RECORDING_OUTCOMES = ['created', 'completed_planned', 'merged', 'matched_manual'] as const;
export type RecordingOutcome = (typeof RECORDING_OUTCOMES)[number];

export class RecordedActivityAcceptedDto {
  @ApiProperty({ format: 'uuid' })
  recordedActivityId!: string;

  @ApiProperty({ format: 'uuid' })
  workoutId!: string;

  @ApiProperty({ enum: RECORDING_OUTCOMES })
  outcome!: RecordingOutcome;
}

export class WorkoutRecordingResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: RECORDING_ENVIRONMENTS }) environment!: RecordingEnvironment;
  @ApiProperty({ enum: DISTANCE_SOURCES }) distanceSource!: DistanceSource;
  @ApiProperty() startedAt!: string;
  @ApiProperty() endedAt!: string;
  @ApiProperty() elapsedSec!: number;
  @ApiProperty() movingSec!: number;
  @ApiProperty() distanceM!: number;
  @ApiProperty({ nullable: true, type: Number }) measuredDistanceM!: number | null;
  @ApiProperty({ nullable: true, type: Number }) elevationGainM!: number | null;
  @ApiProperty({ nullable: true, type: Number }) elevationLossM!: number | null;
  @ApiProperty({ nullable: true, type: Number }) avgPaceSecPerKm!: number | null;
  @ApiProperty({ nullable: true, type: Number }) bestPaceSecPerKm!: number | null;
  @ApiProperty({ nullable: true, type: Number }) avgHeartRate!: number | null;
  @ApiProperty({ nullable: true, type: Number }) maxHeartRate!: number | null;
  @ApiProperty({ nullable: true, type: Number }) avgCadence!: number | null;
  @ApiProperty({ type: [RecordedSplitDto] }) splits!: RecordedSplitDto[];
  @ApiProperty({ type: [RecordedLapDto] }) laps!: RecordedLapDto[];
  @ApiProperty({ type: [RecordedPauseDto] }) pauses!: RecordedPauseDto[];
  @ApiProperty({ nullable: true, type: String }) routeLine!: string | null;
  @ApiProperty({ type: RouteBoundsDto, nullable: true }) routeBounds!: RouteBoundsDto | null;
  @ApiProperty({ format: 'uuid', nullable: true, type: String, description: 'Full track, download via /storage/:id' })
  trackFileId!: string | null;
  @ApiProperty({ nullable: true, type: Number }) feeling!: number | null;
  @ApiProperty({ nullable: true, type: Number }) rpe!: number | null;
  @ApiProperty({ nullable: true, type: String }) notes!: string | null;
}
