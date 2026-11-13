import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { PaginationDto } from '@/common/dto/pagination.dto';

import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_DELIVERY_ERRORS,
  NOTIFICATION_DELIVERY_STATUSES,
  NOTIFICATION_LINK_TARGETS,
  NOTIFICATION_TYPE_KEYS,
  type NotificationCategory,
  type NotificationChannel,
  type NotificationDeliveryError,
  type NotificationDeliveryStatus,
  type NotificationLinkTarget,
  type NotificationType,
  PUSH_PLATFORMS,
  type PushPlatform,
} from '../notifications.constants';

const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === 'true' ? true : value === 'false' ? false : value;

export class NotificationListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: NOTIFICATION_CATEGORIES })
  @IsOptional()
  @IsIn(NOTIFICATION_CATEGORIES)
  category?: NotificationCategory;

  @ApiPropertyOptional({ description: 'Only unread notifications' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unread?: boolean;
}

export class NotificationLinkDto {
  @ApiProperty({ enum: NOTIFICATION_LINK_TARGETS, description: 'Screen the app opens on tap' })
  target!: NotificationLinkTarget;

  @ApiProperty({ type: String, nullable: true, description: 'Entity of the target: coach session, workout or plan' })
  id!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Only for the `url` target' })
  url!: string | null;
}

export class NotificationResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: NOTIFICATION_CATEGORIES })
  category!: NotificationCategory;

  @ApiProperty({ enum: NOTIFICATION_TYPE_KEYS })
  type!: NotificationType;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Written title in the request language; null — clients show the sender of the category',
  })
  title!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Written text; null — clients render the type with `params`',
  })
  body!: string | null;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Values for rendering system types' })
  params!: Record<string, string | number | boolean | null>;

  @ApiProperty({ type: () => NotificationLinkDto, nullable: true })
  link!: NotificationLinkDto | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class NotificationUnreadCountResponseDto {
  @ApiProperty({ example: 3 })
  count!: number;
}

export class MarkNotificationsReadDto {
  @ApiProperty({ type: [String], format: 'uuid', maxItems: 100 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  ids!: string[];
}

export class RegisterPushDeviceDto {
  @ApiProperty({ example: 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^Expo(nent)?PushToken\[.+\]$/, { message: 'token must be an Expo push token' })
  token!: string;

  @ApiProperty({ enum: PUSH_PLATFORMS })
  @IsIn(PUSH_PLATFORMS)
  platform!: PushPlatform;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'ru-RU', maxLength: 8 })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  locale?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '1.4.0', maxLength: 32 })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  appVersion?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: 'iPhone 16', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string | null;
}

export class UnregisterPushDeviceDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;
}

export class PushDeviceResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: PUSH_PLATFORMS })
  platform!: PushPlatform;

  @ApiProperty({ type: String, nullable: true })
  locale!: string | null;

  @ApiProperty({ type: String, nullable: true })
  appVersion!: string | null;

  @ApiProperty({ type: String, nullable: true })
  deviceName!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  lastSeenAt!: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;
}

export class PushDeviceListResponseDto {
  @ApiProperty({ type: [PushDeviceResponseDto] })
  items!: PushDeviceResponseDto[];
}

export class NotificationDeliveryResponseDto {
  @ApiProperty({ enum: NOTIFICATION_CHANNELS })
  channel!: NotificationChannel;

  @ApiProperty({ enum: NOTIFICATION_DELIVERY_STATUSES })
  status!: NotificationDeliveryStatus;

  @ApiProperty({ enum: NOTIFICATION_DELIVERY_ERRORS, nullable: true })
  error!: NotificationDeliveryError | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  sentAt!: Date | null;
}

/** An inbox entry as the admin panel sees it: with delivery status per channel. */
export class AdminNotificationResponseDto extends NotificationResponseDto {
  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  broadcastId!: string | null;

  @ApiProperty({ type: [NotificationDeliveryResponseDto] })
  deliveries!: NotificationDeliveryResponseDto[];
}

export class AdminNotificationListQueryDto extends NotificationListQueryDto {}
