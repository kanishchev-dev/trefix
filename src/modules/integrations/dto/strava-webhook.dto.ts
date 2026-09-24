import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class StravaWebhookEventDto {
  @ApiProperty({ example: 'activity', enum: ['activity', 'athlete'] })
  @IsEnum(['activity', 'athlete'])
  object_type!: 'activity' | 'athlete';

  @ApiProperty({ example: 123456789 })
  @IsNumber()
  object_id!: number;

  @ApiProperty({ example: 'create', enum: ['create', 'update', 'delete'] })
  @IsEnum(['create', 'update', 'delete'])
  aspect_type!: 'create' | 'update' | 'delete';

  @ApiProperty({ example: 987654 })
  @IsNumber()
  owner_id!: number;

  @ApiProperty({ example: 12345 })
  @IsNumber()
  subscription_id!: number;

  @ApiProperty({ example: 1774390800 })
  @IsNumber()
  event_time!: number;

  @ApiPropertyOptional({ example: { title: 'New Run Name' } })
  @IsOptional()
  @IsObject()
  updates?: Record<string, unknown>;
}

export class StravaWebhookVerificationQueryDto {
  @IsString()
  'hub.mode'!: string;

  @IsString()
  'hub.challenge'!: string;

  @IsString()
  'hub.verify_token'!: string;
}
