import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

import { ACTOR_TYPES, type ActorType } from '@/common/context/activity-context';

import {
  ACTIVITY_DOMAINS,
  ACTIVITY_PAGE_LIMIT_DEFAULT,
  ACTIVITY_PAGE_LIMIT_MAX,
  type ActivityDomain,
} from '../activity.constants';

const toArray = ({ value }: { value: unknown }): unknown =>
  value === undefined ? undefined : Array.isArray(value) ? value : String(value).split(',').filter(Boolean);

/** Filters shared by the history of one user and the global log. */
export class ActivityFilterDto {
  @ApiPropertyOptional({ enum: ACTIVITY_DOMAINS, isArray: true, description: 'Sections; comma-separated or repeated' })
  @IsOptional()
  @Transform(toArray)
  @IsIn(ACTIVITY_DOMAINS, { each: true })
  domain?: ActivityDomain[];

  @ApiPropertyOptional({ enum: ACTOR_TYPES, isArray: true, description: 'Kinds of actor; comma-separated or repeated' })
  @IsOptional()
  @Transform(toArray)
  @IsIn(ACTOR_TYPES, { each: true })
  actorType?: ActorType[];

  @ApiPropertyOptional({ format: 'date-time', description: 'Entries at or after this moment' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'Entries before this moment' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ example: 'workout', description: 'History of one entity, together with `entityId`' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  entityType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  entityId?: string;

  @ApiPropertyOptional({ description: 'Matches the action name or the exact entity id' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

export class ActivityPageQueryDto extends ActivityFilterDto {
  @ApiPropertyOptional({ description: 'Cursor from the previous page' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  cursor?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: ACTIVITY_PAGE_LIMIT_MAX, default: ACTIVITY_PAGE_LIMIT_DEFAULT })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ACTIVITY_PAGE_LIMIT_MAX)
  limit?: number;
}

export const ACTIVITY_LOG_KINDS = ['admin', 'data_access', 'all'] as const;
export type ActivityLogKind = (typeof ACTIVITY_LOG_KINDS)[number];

/** Extra filters of the global log. */
export class ActivityLogQueryDto extends ActivityPageQueryDto {
  @ApiPropertyOptional({ enum: ACTIVITY_LOG_KINDS, default: 'admin' })
  @IsOptional()
  @IsIn(ACTIVITY_LOG_KINDS)
  kind?: ActivityLogKind;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subjectUserId?: string;
}

export class ActivityLogExportQueryDto extends ActivityFilterDto {
  @ApiPropertyOptional({ enum: ACTIVITY_LOG_KINDS, default: 'admin' })
  @IsOptional()
  @IsIn(ACTIVITY_LOG_KINDS)
  kind?: ActivityLogKind;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  actorUserId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  subjectUserId?: string;
}
