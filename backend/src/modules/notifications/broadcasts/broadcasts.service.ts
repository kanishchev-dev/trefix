import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';
import { col, fn, Op } from 'sequelize';

import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { UsersService } from '@/modules/users/users.service';

import type {
  AudiencePreviewResponseDto,
  BroadcastChannelStatsDto,
  BroadcastListQueryDto,
  BroadcastRecipientResponseDto,
  BroadcastResponseDto,
  CreateBroadcastDto,
} from '../dto/broadcast.dto';
import type { NotificationListQueryDto } from '../dto/notification.dto';
import { Notification } from '../entities/notification.entity';
import { NotificationBroadcast } from '../entities/notification-broadcast.entity';
import { NotificationDelivery } from '../entities/notification-delivery.entity';
import { BroadcastCompletedEvent, BroadcastCreatedEvent } from '../events/notification.events';
import { NotificationSenderService } from '../notification-sender.service';
import {
  BROADCAST_BATCH_SIZE,
  type BroadcastAudience,
  type NotificationChannel,
  type NotificationContent,
  type NotificationDeliveryStatus,
  NOTIFICATIONS_BROADCAST_JOB,
  NOTIFICATIONS_BROADCAST_QUEUE,
} from '../notifications.constants';
import { NOTIFICATIONS_EVENTS } from '../notifications.events';
import { NotificationsService } from '../notifications.service';
import { PushDevicesService } from '../push/push-devices.service';
import { AudienceResolverService } from './audience-resolver.service';

export interface BroadcastJob {
  broadcastId: string;
}

const EMPTY_STATS = (): BroadcastChannelStatsDto => ({ pending: 0, sent: 0, delivered: 0, failed: 0, skipped: 0 });

/** Notifications written by administrators to one user, a group, a segment or everyone. */
@Injectable()
export class BroadcastsService {
  private readonly logger = new Logger(BroadcastsService.name);

  constructor(
    @InjectModel(NotificationBroadcast)
    private readonly broadcastModel: typeof NotificationBroadcast,
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
    @InjectModel(NotificationDelivery)
    private readonly deliveryModel: typeof NotificationDelivery,
    @InjectQueue(NOTIFICATIONS_BROADCAST_QUEUE)
    private readonly queue: Queue<BroadcastJob>,
    private readonly audienceResolver: AudienceResolverService,
    private readonly sender: NotificationSenderService,
    private readonly notificationsService: NotificationsService,
    private readonly devicesService: PushDevicesService,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async preview(audience: BroadcastAudience): Promise<AudiencePreviewResponseDto> {
    const ids = await this.audienceResolver.resolve(audience);
    const withPush = await this.devicesService.usersWithDevices(ids);
    return { recipients: ids.length, withPush: withPush.size };
  }

  /** Stores the broadcast and hands the fan-out to the queue; the response does not wait for it. */
  async create(actorUserId: string, dto: CreateBroadcastDto): Promise<BroadcastResponseDto> {
    const content = toContent(dto);
    if (Object.keys(content).length === 0) {
      throw new DomainBadRequestException('NOTIFICATION_CONTENT_REQUIRED', 'Write the text in at least one language');
    }
    if (dto.link?.target === 'url' && !dto.link.url) {
      throw new DomainBadRequestException('NOTIFICATION_LINK_URL_REQUIRED', 'A link to a page needs its address');
    }
    const audience = toAudience(dto);
    const recipients = await this.audienceResolver.resolve(audience);
    if (recipients.length === 0) {
      throw new DomainBadRequestException('NOTIFICATION_AUDIENCE_EMPTY', 'Nobody matches the chosen recipients');
    }
    const broadcast = await this.broadcastModel.create({
      createdBy: actorUserId,
      audience,
      content,
      link: dto.link ? { target: dto.link.target, id: dto.link.id ?? null, url: dto.link.url ?? null } : null,
      channels: [...new Set(dto.channels)],
      status: 'queued',
      recipientsCount: recipients.length,
    });
    await this.queue.add(
      NOTIFICATIONS_BROADCAST_JOB,
      { broadcastId: broadcast.id },
      { jobId: `broadcast:${broadcast.id}` },
    );
    this.eventEmitter.emit(
      NOTIFICATIONS_EVENTS.BROADCAST_CREATED,
      new BroadcastCreatedEvent(
        broadcast.id,
        actorUserId,
        audience.type,
        broadcast.channels,
        recipients.length === 1 && audience.type === 'users' ? recipients[0] : null,
      ),
    );
    return this.get(broadcast.id);
  }

  /**
   * Creates the inbox entries in batches. Resumable: recipients that already
   * got this broadcast (a retried job) are skipped.
   */
  async fanOut(broadcastId: string, now = new Date()): Promise<void> {
    const broadcast = await this.broadcastModel.findByPk(broadcastId);
    if (!broadcast || broadcast.status === 'sent') {
      return;
    }
    await broadcast.update({ status: 'sending' });
    const recipients = await this.audienceResolver.resolve(broadcast.audience);
    const done = new Set(
      (await this.notificationModel.findAll({ where: { broadcastId }, attributes: ['userId'] })).map(
        (row) => row.userId,
      ),
    );
    const pending = recipients.filter((userId) => !done.has(userId));
    for (let index = 0; index < pending.length; index += BROADCAST_BATCH_SIZE) {
      await this.sender.notifyMany(
        pending.slice(index, index + BROADCAST_BATCH_SIZE).map((userId) => ({
          userId,
          type: 'admin.message' as const,
          content: broadcast.content,
          link: broadcast.link,
          channels: broadcast.channels,
          broadcastId,
        })),
      );
    }
    const total = done.size + pending.length;
    await broadcast.update({ status: 'sent', recipientsCount: total, completedAt: now, error: null });
    this.eventEmitter.emit(
      NOTIFICATIONS_EVENTS.BROADCAST_COMPLETED,
      new BroadcastCompletedEvent(broadcastId, 'sent', total),
    );
    this.logger.log(`Broadcast ${broadcastId} delivered to ${total} inboxes`);
  }

  async markFailed(broadcastId: string, error: string): Promise<void> {
    await this.broadcastModel.update(
      { status: 'failed', error: error.slice(0, 500) },
      { where: { id: broadcastId, status: { [Op.ne]: 'sent' } } },
    );
    this.eventEmitter.emit(
      NOTIFICATIONS_EVENTS.BROADCAST_COMPLETED,
      new BroadcastCompletedEvent(broadcastId, 'failed', 0),
    );
  }

  async list(query: BroadcastListQueryDto): Promise<PaginatedResponseDto<BroadcastResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { rows, count } = await this.broadcastModel.findAndCountAll({
      where: query.status ? { status: query.status } : {},
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      offset: (page - 1) * limit,
      limit,
    });
    const views = await this.toViews(rows);
    return new PaginatedResponseDto(views, count, page, limit);
  }

  async get(id: string): Promise<BroadcastResponseDto> {
    const broadcast = await this.broadcastModel.findByPk(id);
    if (!broadcast) {
      throw new EntityNotFoundException('NotificationBroadcast', id);
    }
    const [view] = await this.toViews([broadcast]);
    return view;
  }

  async recipients(
    id: string,
    query: NotificationListQueryDto,
  ): Promise<PaginatedResponseDto<BroadcastRecipientResponseDto>> {
    await this.get(id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const { rows, count } = await this.notificationModel.findAndCountAll({
      where: { broadcastId: id, ...(query.unread ? { readAt: null } : {}) },
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
      offset: (page - 1) * limit,
      limit,
    });
    const names = await this.usersService.findDisplayNames(rows.map((row) => row.userId));
    const deliveries = await this.notificationsService.deliveriesOf(rows.map((row) => row.id));
    return new PaginatedResponseDto(
      rows.map((row) => ({
        notificationId: row.id,
        user: { id: row.userId, name: names.get(row.userId) ?? '' },
        readAt: row.readAt,
        deliveries: deliveries.get(row.id) ?? [],
      })),
      count,
      page,
      limit,
    );
  }

  private async toViews(broadcasts: NotificationBroadcast[]): Promise<BroadcastResponseDto[]> {
    const ids = broadcasts.map((broadcast) => broadcast.id);
    const authors = await this.usersService.findDisplayNames(
      broadcasts.map((broadcast) => broadcast.createdBy).filter((value): value is string => Boolean(value)),
    );
    const stats = await this.stats(ids);
    return broadcasts.map((broadcast) => ({
      id: broadcast.id,
      createdBy: broadcast.createdBy ? { id: broadcast.createdBy, name: authors.get(broadcast.createdBy) ?? '' } : null,
      audience: broadcast.audience,
      content: {
        ...(broadcast.content.ru
          ? { ru: { title: broadcast.content.ru.title ?? null, body: broadcast.content.ru.body } }
          : {}),
        ...(broadcast.content.en
          ? { en: { title: broadcast.content.en.title ?? null, body: broadcast.content.en.body } }
          : {}),
      },
      link: broadcast.link
        ? { target: broadcast.link.target, id: broadcast.link.id ?? null, url: broadcast.link.url ?? null }
        : null,
      channels: broadcast.channels,
      status: broadcast.status,
      recipientsCount: broadcast.recipientsCount,
      error: broadcast.error,
      stats: stats.get(broadcast.id) ?? { read: 0, push: EMPTY_STATS(), email: EMPTY_STATS() },
      createdAt: broadcast.createdAt,
      completedAt: broadcast.completedAt,
    }));
  }

  private async stats(broadcastIds: string[]): Promise<Map<string, BroadcastResponseDto['stats']>> {
    const result = new Map<string, BroadcastResponseDto['stats']>();
    if (broadcastIds.length === 0) {
      return result;
    }
    for (const id of broadcastIds) {
      result.set(id, { read: 0, push: EMPTY_STATS(), email: EMPTY_STATS() });
    }
    const reads = (await this.notificationModel.findAll({
      where: { broadcastId: { [Op.in]: broadcastIds }, readAt: { [Op.ne]: null } },
      attributes: ['broadcastId', [fn('COUNT', col('id')), 'count']],
      group: ['broadcastId'],
      raw: true,
    })) as unknown as Array<{ broadcastId: string; count: string }>;
    for (const row of reads) {
      const entry = result.get(row.broadcastId);
      if (entry) {
        entry.read = Number(row.count);
      }
    }
    const deliveries = (await this.deliveryModel.sequelize!.query(
      `SELECT n.broadcast_id AS "broadcastId", d.channel, d.status, COUNT(*)::int AS count
         FROM notification_deliveries d
         JOIN notifications n ON n.id = d.notification_id
        WHERE n.broadcast_id IN (:ids)
        GROUP BY n.broadcast_id, d.channel, d.status`,
      { replacements: { ids: broadcastIds }, type: 'SELECT' },
    )) as Array<{
      broadcastId: string;
      channel: NotificationChannel;
      status: NotificationDeliveryStatus;
      count: number;
    }>;
    for (const row of deliveries) {
      const entry = result.get(row.broadcastId);
      if (entry) {
        entry[row.channel][row.status] = row.count;
      }
    }
    return result;
  }
}

function toContent(dto: CreateBroadcastDto): NotificationContent {
  const content: NotificationContent = {};
  for (const language of ['ru', 'en'] as const) {
    const text = dto.content[language];
    if (text?.body) {
      content[language] = { title: text.title || null, body: text.body };
    }
  }
  return content;
}

function toAudience(dto: CreateBroadcastDto): BroadcastAudience {
  const { audience } = dto;
  switch (audience.type) {
    case 'users':
      return { type: 'users', userIds: audience.userIds ?? [] };
    case 'group':
      return { type: 'group', groupId: audience.groupId };
    case 'segment':
      return { type: 'segment', segment: { ...(audience.segment ?? {}) } };
    default:
      return { type: 'all' };
  }
}
