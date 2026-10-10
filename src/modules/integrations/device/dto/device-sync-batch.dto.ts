import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

import {
  DEVICE_ACTIVITY_REJECT_CODES,
  DEVICE_SYNC_BATCH_MAX,
  DEVICE_SYNC_TYPES,
  type DeviceActivityRejectCode,
  type DeviceSyncType,
} from '../../constants/integrations.constants';

/**
 * A run read from Apple Health / Health Connect. Only the shape is validated
 * here; plausibility is checked per item so one bad record does not fail the batch.
 */
export class DeviceActivityDto {
  @ApiProperty({ example: '4C1B2F2E-9D0A-4C59-9E2B-8E8F6F2C1A11' })
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  sourceActivityId!: string;

  @ApiProperty({ example: 'run', description: 'run | trail_run | treadmill; anything else is rejected per item' })
  @IsString()
  @MaxLength(32)
  type!: string;

  @ApiProperty({ example: '2026-10-08T04:12:03Z' })
  @IsISO8601()
  startedAt!: string;

  @ApiProperty({ example: '2026-10-08T05:01:44Z' })
  @IsISO8601()
  endedAt!: string;

  @ApiPropertyOptional({ example: 180, description: 'Minutes east of UTC at the start' })
  @IsOptional()
  @IsInt()
  @Min(-720)
  @Max(840)
  utcOffsetMinutes?: number;

  @ApiProperty({ example: 2890, description: 'Moving time, seconds' })
  @IsInt()
  @Min(0)
  durationSec!: number;

  @ApiPropertyOptional({ example: 2981 })
  @IsOptional()
  @IsInt()
  @Min(0)
  elapsedTimeSec?: number;

  @ApiProperty({ example: 10230 })
  @IsNumber()
  @Min(0)
  distanceMeters!: number;

  @ApiPropertyOptional({ example: 64 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  elevationGainMeters?: number;

  @ApiPropertyOptional({ example: 148 })
  @IsOptional()
  @IsNumber()
  averageHeartRate?: number;

  @ApiPropertyOptional({ example: 171 })
  @IsOptional()
  @IsNumber()
  maxHeartRate?: number;

  @ApiPropertyOptional({ example: 172, description: 'Steps per minute' })
  @IsOptional()
  @IsNumber()
  cadence?: number;

  @ApiPropertyOptional({ example: 712 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  calories?: number;

  @ApiPropertyOptional({ example: 'com.apple.health', description: 'Bundle id / package that wrote the record' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originAppId?: string;

  @ApiPropertyOptional({ example: 'Apple Watch' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  originDevice?: string;
}

export class DeviceSyncBatchDto {
  @ApiProperty({
    example: '0192f3c4-6d1a-7b0e-9c3f-2a1b4c5d6e7f',
    description: 'Client-generated id of the sync session',
  })
  @IsUUID()
  syncId!: string;

  @ApiProperty({ example: 0 })
  @IsInt()
  @Min(0)
  @Max(100_000)
  batchIndex!: number;

  @ApiProperty({ enum: DEVICE_SYNC_TYPES })
  @IsIn(DEVICE_SYNC_TYPES)
  syncType!: DeviceSyncType;

  @ApiProperty({ example: false, description: 'The last batch of the session' })
  @IsBoolean()
  isLast!: boolean;

  @ApiProperty({ type: [DeviceActivityDto] })
  @IsArray()
  @ArrayMaxSize(DEVICE_SYNC_BATCH_MAX)
  @ValidateNested({ each: true })
  @Type(() => DeviceActivityDto)
  activities!: DeviceActivityDto[];

  @ApiPropertyOptional({ type: [String], example: ['9AE0C7B1-…'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(DEVICE_SYNC_BATCH_MAX)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  deletedSourceActivityIds?: string[];
}

export class RejectedDeviceActivityDto {
  @ApiProperty()
  sourceActivityId!: string;

  @ApiProperty({ enum: DEVICE_ACTIVITY_REJECT_CODES })
  code!: DeviceActivityRejectCode;
}

export class DeviceSyncBatchAcceptedDto {
  @ApiProperty()
  syncId!: string;

  @ApiProperty()
  batchId!: string;

  @ApiProperty({ example: 48 })
  accepted!: number;

  @ApiProperty({ type: [RejectedDeviceActivityDto] })
  rejected!: RejectedDeviceActivityDto[];
}
