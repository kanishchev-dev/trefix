import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type WhereOptions } from 'sequelize';

import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import type { PreferenceLanguage } from '@/modules/users/users.constants';

import {
  type AdminNotificationResponseDto,
  type NotificationDeliveryResponseDto,
  type NotificationListQueryDto,
  type NotificationResponseDto,
} from './dto/notification.dto';
import { Notification } from './entities/notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationDeletedEvent, NotificationsReadEvent } from './events/notification.events';
import { pickText } from './notification-texts';
import { NOTIFICATIONS_PAGE_LIMIT_DEFAULT } from './notifications.constants';
import { NOTIFICATIONS_EVENTS } from './notifications.events';

/** The user's inbox: reading, marking as read and removing entries. */
@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
    @InjectModel(NotificationDelivery)
    private readonly deliveryModel: typeof NotificationDelivery,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(
    userId: string,
    query: NotificationListQueryDto,
    language: PreferenceLanguage,
  ): Promise<PaginatedResponseDto<NotificationResponseDto>> {
    const { rows, total, page, limit } = await this.page(userId, query);
    return new PaginatedResponseDto(
      rows.map((row) => toNotificationResponse(row, language)),
      total,
      page,
      limit,
    );
  }

  /** The inbox of any user with the delivery status per channel, for the admin panel. */
  async listForAdmin(
    userId: string,
    query: NotificationListQueryDto,
    language: PreferenceLanguage,
  ): Promise<PaginatedResponseDto<AdminNotificationResponseDto>> {
    const { rows, total, page, limit } = await this.page(userId, query);
    const deliveries = await this.deliveriesOf(rows.map((row) => row.id));
    return new PaginatedResponseDto(
      rows.map((row) => ({
        ...toNotificationResponse(row, language),
        broadcastId: row.broadcastId,
        deliveries: deliveries.get(row.id) ?? [],
      })),
      total,
      page,
      limit,
    );
  }

  unreadCount(userId: string): Promise<number> {
    return this.notificationModel.count({ where: { userId, readAt: null } });
  }

  /** Ids of other users are ignored, so a client cannot learn whether they exist. */
  async markRead(userId: string, ids: string[], now = new Date()): Promise<number> {
    const [updated] = await this.notificationModel.update(
      { readAt: now },
      { where: { userId, id: { [Op.in]: ids }, readAt: null } },
    );
    if (updated > 0) {
      this.eventEmitter.emit(NOTIFICATIONS_EVENTS.READ, new NotificationsReadEvent(userId, ids, false));
    }
    return this.unreadCount(userId);
  }

  async markAllRead(userId: string, now = new Date()): Promise<number> {
    const [updated] = await this.notificationModel.update({ readAt: now }, { where: { userId, readAt: null } });
    if (updated > 0) {
      this.eventEmitter.emit(NOTIFICATIONS_EVENTS.READ, new NotificationsReadEvent(userId, [], true));
    }
    return 0;
  }

  async remove(userId: string, id: string): Promise<void> {
    const notification = await this.notificationModel.findOne({ where: { id, userId } });
    if (!notification) {
      throw new EntityNotFoundException('Notification', id);
    }
    await notification.destroy();
    this.eventEmitter.emit(NOTIFICATIONS_EVENTS.DELETED, new NotificationDeletedEvent(userId, id));
  }

  /** Removes entries older than `before`; deliveries go with them (FK cascade). */
  async purgeOlderThan(before: Date): Promise<number> {
    return this.notificationModel.destroy({ where: { createdAt: { [Op.lt]: before } } });
  }

  async deliveriesOf(notificationIds: readonly string[]): Promise<Map<string, NotificationDeliveryResponseDto[]>> {
    const grouped = new Map<string, NotificationDeliveryResponseDto[]>();
    if (notificationIds.length === 0) {
      return grouped;
    }
    const deliveries = await this.deliveryModel.findAll({
      where: { notificationId: { [Op.in]: [...notificationIds] } },
      order: [['channel', 'DESC']],
    });
    for (const delivery of deliveries) {
      const list = grouped.get(delivery.notificationId) ?? [];
      list.push({ channel: delivery.channel, status: delivery.status, error: delivery.error, sentAt: delivery.sentAt });
      grouped.set(delivery.notificationId, list);
    }
    return grouped;
  }

  private async page(
    userId: string,
    query: NotificationListQueryDto,
  ): Promise<{ rows: Notification[]; total: number; page: number; limit: number }> {
    const page = query.page ?? 1;
    const limit = query.limit ?? NOTIFICATIONS_PAGE_LIMIT_DEFAULT;
    const where: WhereOptions<Notification> = {
      userId,
      ...(query.category ? { category: query.category } : {}),
      ...(query.unread ? { readAt: null } : {}),
    };
    const { rows, count } = await this.notificationModel.findAndCountAll({
      where,
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
      offset: (page - 1) * limit,
      limit,
    });
    return { rows, total: count, page, limit };
  }
}

export function toNotificationResponse(
  notification: Notification,
  language: PreferenceLanguage,
): NotificationResponseDto {
  const text = pickText(notification.content ?? {}, language);
  return {
    id: notification.id,
    category: notification.category,
    type: notification.type,
    title: text?.title ?? null,
    body: text?.body ?? null,
    params: notification.params ?? {},
    link: notification.link
      ? { target: notification.link.target, id: notification.link.id ?? null, url: notification.link.url ?? null }
      : null,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  };
}
