import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

import { PaginationDto } from '@/common/dto/pagination.dto';
import { PREFERENCE_LANGUAGES, type PreferenceLanguage } from '@/modules/users/users.constants';

import {
  BROADCAST_AUDIENCE_TYPES,
  BROADCAST_STATUSES,
  BROADCAST_USERS_MAX,
  type BroadcastAudienceType,
  type BroadcastStatus,
  NOTIFICATION_BODY_MAX_LENGTH,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_LINK_TARGETS,
  NOTIFICATION_TITLE_MAX_LENGTH,
  NOTIFICATION_URL_MAX_LENGTH,
  type NotificationChannel,
  type NotificationLinkTarget,
  PUSH_PLATFORMS,
  type PushPlatform,
} from '../notifications.constants';
import { NotificationDeliveryResponseDto, NotificationLinkDto } from './notification.dto';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class BroadcastTextDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: NOTIFICATION_TITLE_MAX_LENGTH })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(NOTIFICATION_TITLE_MAX_LENGTH)
  title?: string | null;

  @ApiProperty({ maxLength: NOTIFICATION_BODY_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOTIFICATION_BODY_MAX_LENGTH)
  body!: string;
}

/** At least one language is required; readers of another language get the first written one. */
export class BroadcastContentDto {
  @ApiPropertyOptional({ type: () => BroadcastTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BroadcastTextDto)
  ru?: BroadcastTextDto;

  @ApiPropertyOptional({ type: () => BroadcastTextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BroadcastTextDto)
  en?: BroadcastTextDto;
}

export class BroadcastLinkDto {
  @ApiProperty({ enum: NOTIFICATION_LINK_TARGETS })
  @IsIn(NOTIFICATION_LINK_TARGETS)
  target!: NotificationLinkTarget;

  @ApiPropertyOptional({ type: String, nullable: true, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  id?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: NOTIFICATION_URL_MAX_LENGTH })
  @ValidateIf((link: BroadcastLinkDto) => link.target === 'url')
  @IsUrl({ protocols: ['https'], require_protocol: true })
  @MaxLength(NOTIFICATION_URL_MAX_LENGTH)
  url?: string | null;
}

export class BroadcastSegmentDto {
  @ApiPropertyOptional({ enum: PREFERENCE_LANGUAGES, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PREFERENCE_LANGUAGES, { each: true })
  languages?: PreferenceLanguage[];

  @ApiPropertyOptional({
    enum: PUSH_PLATFORMS,
    isArray: true,
    description: 'Users with a push device of these platforms',
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsIn(PUSH_PLATFORMS, { each: true })
  platforms?: PushPlatform[];

  @ApiPropertyOptional({ format: 'date', example: '2026-09-01' })
  @IsOptional()
  @IsISO8601({ strict: true })
  registeredFrom?: string;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-01' })
  @IsOptional()
  @IsISO8601({ strict: true })
  registeredTo?: string;

  @ApiPropertyOptional({ description: 'true — with an active plan, false — without one' })
  @IsOptional()
  @IsBoolean()
  activePlan?: boolean;
}

export class BroadcastAudienceDto {
  @ApiProperty({ enum: BROADCAST_AUDIENCE_TYPES })
  @IsIn(BROADCAST_AUDIENCE_TYPES)
  type!: BroadcastAudienceType;

  @ApiPropertyOptional({ type: [String], format: 'uuid', maxItems: BROADCAST_USERS_MAX, description: 'For `users`' })
  @ValidateIf((audience: BroadcastAudienceDto) => audience.type === 'users')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(BROADCAST_USERS_MAX)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  userIds?: string[];

  @ApiPropertyOptional({ format: 'uuid', description: 'Permission group, for `group`' })
  @ValidateIf((audience: BroadcastAudienceDto) => audience.type === 'group')
  @IsUUID()
  groupId?: string;

  @ApiPropertyOptional({ type: () => BroadcastSegmentDto, description: 'For `segment`' })
  @ValidateIf((audience: BroadcastAudienceDto) => audience.type === 'segment')
  @ValidateNested()
  @Type(() => BroadcastSegmentDto)
  segment?: BroadcastSegmentDto;
}

export class CreateBroadcastDto {
  @ApiProperty({ type: () => BroadcastAudienceDto })
  @ValidateNested()
  @Type(() => BroadcastAudienceDto)
  audience!: BroadcastAudienceDto;

  @ApiProperty({ type: () => BroadcastContentDto })
  @ValidateNested()
  @Type(() => BroadcastContentDto)
  content!: BroadcastContentDto;

  @ApiPropertyOptional({ type: () => BroadcastLinkDto, nullable: true })
  @IsOptional()
  @ValidateNested()
  @Type(() => BroadcastLinkDto)
  link?: BroadcastLinkDto | null;

  @ApiProperty({
    enum: NOTIFICATION_CHANNELS,
    isArray: true,
    description: 'Channels besides the inbox; empty — the inbox only',
  })
  @IsArray()
  @ArrayUnique()
  @IsIn(NOTIFICATION_CHANNELS, { each: true })
  channels!: NotificationChannel[];
}

export class AudiencePreviewDto {
  @ApiProperty({ type: () => BroadcastAudienceDto })
  @ValidateNested()
  @Type(() => BroadcastAudienceDto)
  audience!: BroadcastAudienceDto;
}

export class AudiencePreviewResponseDto {
  @ApiProperty({ description: 'Active accounts the broadcast would reach' })
  recipients!: number;

  @ApiProperty({ description: 'Of them, with at least one push device' })
  withPush!: number;
}

export class BroadcastListQueryDto extends PaginationDto {
  @ApiPropertyOptional({ enum: BROADCAST_STATUSES })
  @IsOptional()
  @IsIn(BROADCAST_STATUSES)
  status?: BroadcastStatus;
}

export class BroadcastAuthorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

export class BroadcastTextResponseDto {
  @ApiProperty({ type: String, nullable: true })
  title!: string | null;

  @ApiProperty()
  body!: string;
}

export class BroadcastContentResponseDto {
  @ApiPropertyOptional({ type: () => BroadcastTextResponseDto })
  ru?: BroadcastTextResponseDto;

  @ApiPropertyOptional({ type: () => BroadcastTextResponseDto })
  en?: BroadcastTextResponseDto;
}

export class BroadcastSegmentResponseDto {
  @ApiPropertyOptional({ enum: PREFERENCE_LANGUAGES, isArray: true })
  languages?: PreferenceLanguage[];

  @ApiPropertyOptional({ enum: PUSH_PLATFORMS, isArray: true })
  platforms?: PushPlatform[];

  @ApiPropertyOptional({ format: 'date' })
  registeredFrom?: string;

  @ApiPropertyOptional({ format: 'date' })
  registeredTo?: string;

  @ApiPropertyOptional()
  activePlan?: boolean;
}

export class BroadcastAudienceResponseDto {
  @ApiProperty({ enum: BROADCAST_AUDIENCE_TYPES })
  type!: BroadcastAudienceType;

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  userIds?: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  groupId?: string;

  @ApiPropertyOptional({ type: () => BroadcastSegmentResponseDto })
  segment?: BroadcastSegmentResponseDto;
}

export class BroadcastChannelStatsDto {
  @ApiProperty()
  pending!: number;

  @ApiProperty()
  sent!: number;

  @ApiProperty({ description: 'Confirmed by Apple/Google (push only)' })
  delivered!: number;

  @ApiProperty()
  failed!: number;

  @ApiProperty()
  skipped!: number;
}

export class BroadcastStatsDto {
  @ApiProperty({ description: 'Recipients who opened the notification in the app' })
  read!: number;

  @ApiProperty({ type: () => BroadcastChannelStatsDto })
  push!: BroadcastChannelStatsDto;

  @ApiProperty({ type: () => BroadcastChannelStatsDto })
  email!: BroadcastChannelStatsDto;
}

export class BroadcastResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: () => BroadcastAuthorDto, nullable: true })
  createdBy!: BroadcastAuthorDto | null;

  @ApiProperty({ type: () => BroadcastAudienceResponseDto })
  audience!: BroadcastAudienceResponseDto;

  @ApiProperty({ type: () => BroadcastContentResponseDto })
  content!: BroadcastContentResponseDto;

  @ApiProperty({ type: () => NotificationLinkDto, nullable: true })
  link!: NotificationLinkDto | null;

  @ApiProperty({ enum: NOTIFICATION_CHANNELS, isArray: true })
  channels!: NotificationChannel[];

  @ApiProperty({ enum: BROADCAST_STATUSES })
  status!: BroadcastStatus;

  @ApiProperty()
  recipientsCount!: number;

  @ApiProperty({ type: String, nullable: true })
  error!: string | null;

  @ApiProperty({ type: () => BroadcastStatsDto })
  stats!: BroadcastStatsDto;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: Date | null;
}

export class BroadcastRecipientUserDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ description: 'Display name; empty for a purged account' })
  name!: string;
}

export class BroadcastRecipientResponseDto {
  @ApiProperty({ format: 'uuid' })
  notificationId!: string;

  @ApiProperty({ type: () => BroadcastRecipientUserDto })
  user!: BroadcastRecipientUserDto;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  readAt!: Date | null;

  @ApiProperty({ type: [NotificationDeliveryResponseDto] })
  deliveries!: NotificationDeliveryResponseDto[];
}
