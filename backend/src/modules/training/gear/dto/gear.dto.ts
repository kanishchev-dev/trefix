import { ApiProperty, ApiPropertyOptional, OmitType, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import {
  GEAR_BRAND_MAX_LENGTH,
  GEAR_DATA_SOURCES,
  GEAR_INITIAL_DISTANCE_MAX_KM,
  GEAR_LIMIT_KM_DEFAULT,
  GEAR_LIMIT_KM_RANGE,
  GEAR_MODEL_MAX_LENGTH,
  GEAR_NICKNAME_MAX_LENGTH,
  GEAR_SOURCES,
  GEAR_STATUSES,
  GEAR_TYPES,
  type GearDataSource,
  type GearSource,
  type GearStatus,
  type GearType,
  WORKOUT_TYPES,
  type WorkoutType,
} from '../../training.constants';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateGearDto {
  @ApiPropertyOptional({ enum: GEAR_TYPES, default: 'shoes' })
  @IsOptional()
  @IsIn(GEAR_TYPES)
  type?: GearType;

  @ApiProperty({ example: 'Nike', maxLength: GEAR_BRAND_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(GEAR_BRAND_MAX_LENGTH)
  brand!: string;

  @ApiProperty({ example: 'Pegasus 41', maxLength: GEAR_MODEL_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(GEAR_MODEL_MAX_LENGTH)
  model!: string;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'Daily trainer', maxLength: GEAR_NICKNAME_MAX_LENGTH })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(GEAR_NICKNAME_MAX_LENGTH)
  nickname?: string | null;

  @ApiPropertyOptional({ example: 120, default: 0, description: 'Distance covered before adding to Trefix, km' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(GEAR_INITIAL_DISTANCE_MAX_KM)
  initialDistanceKm?: number;

  @ApiPropertyOptional({
    example: 700,
    default: GEAR_LIMIT_KM_DEFAULT,
    ...GEAR_LIMIT_KM_RANGE,
    description: 'Wear limit; shoes only',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(GEAR_LIMIT_KM_RANGE.min)
  @Max(GEAR_LIMIT_KM_RANGE.max)
  limitKm?: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '2026-08-01',
    description: 'When the pair went into use',
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  startedAt?: string | null;

  @ApiPropertyOptional({
    type: [String],
    enum: WORKOUT_TYPES,
    example: ['easy', 'long_run'],
    description: 'Shoes only',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(WORKOUT_TYPES, { each: true })
  defaultWorkoutTypes?: WorkoutType[];

  @ApiPropertyOptional({ default: true, description: 'Remind when 10% of the limit is left; shoes only' })
  @IsOptional()
  @IsBoolean()
  replaceReminder?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Shoes for new workouts when no workout-type default matches; shoes only, one pair at most',
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Main recording device; its data wins over duplicates from other services. Devices only',
  })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({
    enum: GEAR_DATA_SOURCES,
    nullable: true,
    description: 'Service that delivers workouts of this device; devices only',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsIn(GEAR_DATA_SOURCES)
  dataSource?: GearDataSource | null;
}

/** The type is fixed at creation: shoes and devices keep different fields. */
export class UpdateGearDto extends PartialType(OmitType(CreateGearDto, ['type'] as const)) {}

export class GearListQueryDto {
  @ApiPropertyOptional({ enum: GEAR_STATUSES, default: 'active' })
  @IsOptional()
  @IsIn(GEAR_STATUSES)
  status?: GearStatus;

  @ApiPropertyOptional({ enum: GEAR_TYPES, description: 'All types when omitted' })
  @IsOptional()
  @IsIn(GEAR_TYPES)
  type?: GearType;
}

export class AssignWorkoutDeviceDto {
  @ApiProperty({ type: String, nullable: true, example: '01929b5e-6f1d-7c3a-9a55-3b4f1e2d9c10' })
  @IsOptional()
  @IsUUID()
  deviceId!: string | null;
}

export class AssignWorkoutGearDto {
  @ApiProperty({ type: String, nullable: true, example: '01929b5e-6f1d-7c3a-9a55-3b4f1e2d9c10' })
  @IsOptional()
  @IsUUID()
  gearId!: string | null;
}

export class GearResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: GEAR_TYPES })
  type!: GearType;

  @ApiProperty({ example: 'Nike' })
  brand!: string;

  @ApiProperty({ example: 'Pegasus 41' })
  model!: string;

  @ApiProperty({ type: String, nullable: true })
  nickname!: string | null;

  @ApiProperty({ example: 0 })
  initialDistanceKm!: number;

  @ApiProperty({ type: Number, nullable: true, example: 700, description: 'Shoes only' })
  limitKm!: number | null;

  @ApiProperty({ type: String, nullable: true, example: '2026-08-01' })
  startedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  retiredAt!: Date | null;

  @ApiProperty({ enum: GEAR_STATUSES })
  status!: GearStatus;

  @ApiProperty({ type: [String], enum: WORKOUT_TYPES })
  defaultWorkoutTypes!: WorkoutType[];

  @ApiProperty()
  replaceReminder!: boolean;

  @ApiProperty({ enum: GEAR_SOURCES })
  source!: GearSource;

  @ApiProperty({ description: 'Default shoes for new workouts' })
  isDefault!: boolean;

  @ApiProperty({ description: 'Main recording device' })
  isPrimary!: boolean;

  @ApiProperty({ enum: GEAR_DATA_SOURCES, nullable: true })
  dataSource!: GearDataSource | null;

  @ApiProperty({ example: 412.5, description: 'Initial distance plus completed workouts' })
  distanceKm!: number;

  @ApiProperty({ example: 38 })
  workoutsCount!: number;

  @ApiProperty({ type: Number, nullable: true, example: 332, description: 'Over workouts with duration and distance' })
  averagePaceSecondsPerKm!: number | null;

  @ApiProperty({ example: 42.5, description: 'Average weekly distance over the last 4 weeks; for the wear forecast' })
  weeklyKm!: number;

  @ApiProperty({ type: Number, nullable: true, example: 287.5, description: 'Shoes only' })
  remainingKm!: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 59, description: 'Share of the limit used, %; shoes only' })
  wearPercent!: number | null;

  @ApiProperty({ description: 'Less than 10% of the limit is left' })
  replaceSoon!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class GearListResponseDto {
  @ApiProperty({ type: [GearResponseDto] })
  items!: GearResponseDto[];
}

export class WorkoutGearAssignmentDto {
  @ApiProperty()
  workoutId!: string;

  @ApiProperty({ type: String, nullable: true })
  gearId!: string | null;
}

export class WorkoutDeviceAssignmentDto {
  @ApiProperty()
  workoutId!: string;

  @ApiProperty({ type: String, nullable: true })
  deviceId!: string | null;
}

export class GearImportResultDto {
  @ApiProperty({ example: 2, description: 'Pairs added' })
  created!: number;

  @ApiProperty({ example: 1, description: 'Pairs whose mileage or archive state changed' })
  updated!: number;

  @ApiProperty({ example: 3, description: 'Pairs already up to date' })
  unchanged!: number;

  @ApiProperty({ type: [GearResponseDto], description: 'Added and updated pairs' })
  items!: GearResponseDto[];
}
