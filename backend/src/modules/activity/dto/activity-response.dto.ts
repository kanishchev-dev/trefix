import { ApiProperty } from '@nestjs/swagger';

import { ACTIVITY_SOURCES, ACTOR_TYPES } from '@/common/context/activity-context';

import { ACTIVITY_DOMAINS } from '../activity.constants';

export class ActivityActorDto {
  @ApiProperty({ enum: ACTOR_TYPES })
  type!: string;

  @ApiProperty({ type: String, nullable: true, format: 'uuid' })
  id!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Display name of a user or admin actor' })
  name!: string | null;
}

export class ActivityUserRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;
}

export class ActivityEntityDto {
  @ApiProperty({ example: 'workout' })
  type!: string;

  @ApiProperty({ type: String, nullable: true })
  id!: string | null;
}

export class ActivityClientDto {
  @ApiProperty({ type: String, nullable: true, example: 'ios' })
  platform!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '1.4.2' })
  appVersion!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'iPhone 15 Pro' })
  device!: string | null;
}

export class ActivityItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'date-time' })
  occurredAt!: string;

  @ApiProperty({ example: 'training.workout.updated', description: 'Domain event code; clients translate it' })
  action!: string;

  @ApiProperty({ enum: ACTIVITY_DOMAINS })
  domain!: string;

  @ApiProperty({ type: () => ActivityActorDto })
  actor!: ActivityActorDto;

  @ApiProperty({ type: () => ActivityUserRefDto, nullable: true, description: 'Whose history the entry belongs to' })
  subject!: ActivityUserRefDto | null;

  @ApiProperty({ type: () => ActivityEntityDto, nullable: true })
  entity!: ActivityEntityDto | null;

  @ApiProperty({
    type: 'object',
    nullable: true,
    additionalProperties: { type: 'object', properties: { from: {}, to: {} } },
    example: { distanceKm: { from: 8, to: 9 } },
  })
  changes!: Record<string, { from: unknown; to: unknown }> | null;

  @ApiProperty({ type: 'object', additionalProperties: true, description: 'Labels for rendering the entry' })
  metadata!: Record<string, unknown>;

  @ApiProperty({ enum: ACTIVITY_SOURCES })
  source!: string;

  @ApiProperty({ type: () => ActivityClientDto, nullable: true })
  client!: ActivityClientDto | null;

  @ApiProperty({ type: String, nullable: true })
  ip!: string | null;
}

export class ActivityPageDto {
  @ApiProperty({ type: () => ActivityItemDto, isArray: true })
  items!: ActivityItemDto[];

  @ApiProperty({ type: String, nullable: true })
  nextCursor!: string | null;

  @ApiProperty()
  hasNext!: boolean;
}
