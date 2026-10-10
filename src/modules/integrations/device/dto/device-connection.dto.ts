import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  DEVICE_SCOPES,
  DEVICE_SYNC_HISTORY_DEFAULT_DAYS,
  DEVICE_SYNC_HISTORY_MAX_DAYS,
  type DeviceScope,
} from '../../constants/integrations.constants';

export class UpdateDeviceConnectionDto {
  @ApiPropertyOptional({ enum: DEVICE_SCOPES, isArray: true, example: ['workouts', 'heart_rate', 'distance'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(DEVICE_SCOPES.length)
  @IsIn(DEVICE_SCOPES, { each: true })
  grantedScopes?: DeviceScope[];

  @ApiPropertyOptional({ description: 'Update weight and resting HR of the profile from Health', example: true })
  @IsOptional()
  @IsBoolean()
  profileSync?: boolean;

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
}

export class DeviceConnectionDto extends UpdateDeviceConnectionDto {
  @ApiProperty({ enum: ['ios', 'android'] })
  @IsIn(['ios', 'android'])
  platform!: 'ios' | 'android';

  @ApiProperty({ example: '6a1f0c2e-…', description: 'Installation id of the app' })
  @IsString()
  @MaxLength(128)
  deviceId!: string;

  @ApiPropertyOptional({
    example: DEVICE_SYNC_HISTORY_DEFAULT_DAYS,
    minimum: 1,
    maximum: DEVICE_SYNC_HISTORY_MAX_DAYS,
    description: 'How far back the initial sync reads',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(DEVICE_SYNC_HISTORY_MAX_DAYS)
  historyDepthDays?: number;
}
