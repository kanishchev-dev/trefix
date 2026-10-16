import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';
import { I18nService } from 'nestjs-i18n';

import { MailerService } from '@/modules/mailer/mailer.service';
import { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';
import type { PreferenceLanguage } from '@/modules/users/users.constants';
import { UsersService } from '@/modules/users/users.service';

import { Notification } from '../entities/notification.entity';
import { NotificationDelivery, type PushTicketRecord } from '../entities/notification-delivery.entity';
import type { PushDevice } from '../entities/push-device.entity';
import { normalizeLanguage, pickText } from '../notification-texts';
import {
  NOTIFICATIONS_DELIVERY_QUEUE,
  NOTIFICATIONS_FALLBACK_LANGUAGE,
  NOTIFICATIONS_RECEIPTS_JOB,
  PUSH_RECEIPTS_DELAY_MS,
} from '../notifications.constants';
import { ExpoPushClient, type ExpoPushMessage } from '../push/expo-push.client';
import { PushDevicesService } from '../push/push-devices.service';
import type { NotificationDeliveryJob } from './notification-delivery.types';

const NOTIFICATION_MAIL_TEMPLATE = 'notifications/notification';
const DEVICE_NOT_REGISTERED = 'DeviceNotRegistered';

/** Sends one planned delivery over its channel and records the outcome. Safe to run twice. */
@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    @InjectModel(NotificationDelivery)
    private readonly deliveryModel: typeof NotificationDelivery,
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
    @InjectQueue(NOTIFICATIONS_DELIVERY_QUEUE)
    private readonly queue: Queue<NotificationDeliveryJob>,
    private readonly devicesService: PushDevicesService,
    private readonly pushClient: ExpoPushClient,
    private readonly mailerService: MailerService,
    private readonly usersService: UsersService,
    private readonly preferencesService: UserPreferencesService,
    private readonly i18n: I18nService,
    private readonly configService: ConfigService,
  ) {}

  async deliver(deliveryId: string, now = new Date()): Promise<void> {
    const delivery = await this.deliveryModel.findByPk(deliveryId);
    if (!delivery || delivery.status !== 'pending') {
      return;
    }
    const notification = await this.notificationModel.findByPk(delivery.notificationId);
    if (!notification) {
      return;
    }
    await delivery.increment('attempts');
    if (delivery.channel === 'push') {
      await this.deliverPush(delivery, notification, now);
    } else {
      await this.deliverEmail(delivery, notification, now);
    }
  }

  /** Called when the queue gave up on a delivery. */
  async markFailed(deliveryId: string): Promise<void> {
    await this.deliveryModel.update(
      { status: 'failed', error: 'provider_error' },
      { where: { id: deliveryId, status: 'pending' } },
    );
  }

  /** Expo confirms delivery to Apple/Google only in receipts, fetched some minutes after sending. */
  async checkReceipts(deliveryId: string): Promise<void> {
    const delivery = await this.deliveryModel.findByPk(deliveryId);
    const tickets = delivery?.tickets ?? [];
    const ids = tickets.filter((ticket) => ticket.ticketId).map((ticket) => ticket.ticketId as string);
    if (!delivery || delivery.status !== 'sent' || ids.length === 0) {
      return;
    }
    const receipts = await this.pushClient.receipts(ids);
    const notRegistered: string[] = [];
    let delivered = false;
    const updated = tickets.map((ticket) => {
      const receipt = ticket.ticketId ? receipts[ticket.ticketId] : undefined;
      if (!receipt) {
        return ticket;
      }
      if (receipt.status === 'ok') {
        delivered = true;
        return ticket;
      }
      if (receipt.details?.error === DEVICE_NOT_REGISTERED) {
        notRegistered.push(ticket.deviceId);
      }
      return { ...ticket, status: 'error' as const, error: receipt.details?.error ?? receipt.message ?? null };
    });
    await this.devicesService.removeNotRegistered(notRegistered);
    const anyUnknown = updated.some(
      (ticket) => ticket.status === 'ok' && ticket.ticketId && !receipts[ticket.ticketId],
    );
    await delivery.update({
      tickets: updated,
      status: delivered ? 'delivered' : anyUnknown ? 'sent' : 'failed',
      error: delivered || anyUnknown ? null : notRegistered.length > 0 ? 'device_not_registered' : 'provider_error',
    });
  }

  private async deliverPush(delivery: NotificationDelivery, notification: Notification, now: Date): Promise<void> {
    if (!this.configService.get<boolean>('notifications.pushEnabled')) {
      await delivery.update({ status: 'skipped', error: 'push_disabled' });
      return;
    }
    const devices = (await this.devicesService.list(notification.userId)).filter((device) =>
      ExpoPushClient.isExpoToken(device.token),
    );
    if (devices.length === 0) {
      await delivery.update({ status: 'skipped', error: 'no_devices' });
      return;
    }
    const userLanguage = await this.userLanguage(notification.userId);
    const badge = await this.notificationModel.count({ where: { userId: notification.userId, readAt: null } });
    const messages = devices.map((device) => this.pushMessage(notification, device, userLanguage, badge));
    const tickets = await this.pushClient.send(messages);

    const records: PushTicketRecord[] = devices.map((device, index) => {
      const ticket = tickets[index];
      return {
        deviceId: device.id,
        ticketId: ticket?.id ?? null,
        status: ticket?.status === 'ok' ? 'ok' : 'error',
        error: ticket?.status === 'ok' ? null : (ticket?.details?.error ?? ticket?.message ?? 'missing_ticket'),
      };
    });
    const notRegistered = records.filter((record) => record.error === DEVICE_NOT_REGISTERED);
    await this.devicesService.removeNotRegistered(notRegistered.map((record) => record.deviceId));

    const sent = records.some((record) => record.status === 'ok');
    await delivery.update({
      tickets: records,
      status: sent ? 'sent' : 'failed',
      error: sent ? null : notRegistered.length === records.length ? 'device_not_registered' : 'provider_error',
      sentAt: sent ? now : null,
    });
    if (sent) {
      await this.queue.add(
        NOTIFICATIONS_RECEIPTS_JOB,
        { deliveryId: delivery.id },
        { delay: PUSH_RECEIPTS_DELAY_MS, jobId: `receipts:${delivery.id}` },
      );
    }
  }

  private async deliverEmail(delivery: NotificationDelivery, notification: Notification, now: Date): Promise<void> {
    const user = await this.usersService.findOne(notification.userId).catch(() => null);
    if (!user?.email) {
      await delivery.update({ status: 'failed', error: 'invalid_recipient' });
      return;
    }
    const language = (await this.userLanguage(notification.userId)) ?? NOTIFICATIONS_FALLBACK_LANGUAGE;
    const text = this.text(notification, language);
    try {
      await this.mailerService.send({
        to: user.email,
        subject: text.title,
        template: NOTIFICATION_MAIL_TEMPLATE,
        data: { title: text.title, message: text.body },
      });
    } catch (error) {
      this.logger.error(`Cannot email notification ${notification.id}: ${(error as Error).message}`);
      throw error;
    }
    await delivery.update({ status: 'sent', error: null, sentAt: now });
  }

  private pushMessage(
    notification: Notification,
    device: PushDevice,
    userLanguage: PreferenceLanguage | null,
    badge: number,
  ): ExpoPushMessage {
    const language = userLanguage ?? normalizeLanguage(device.locale) ?? NOTIFICATIONS_FALLBACK_LANGUAGE;
    const text = this.text(notification, language);
    return {
      to: device.token,
      title: text.title,
      body: text.body,
      sound: 'default',
      badge,
      channelId: 'default',
      data: { notificationId: notification.id, type: notification.type, link: notification.link },
    };
  }

  /** The title falls back to the sender of the category (`Tref`, `Trefix`). */
  private text(notification: Notification, language: PreferenceLanguage): { title: string; body: string } {
    const written = pickText(notification.content, language);
    const title =
      written?.title ||
      (this.i18n.translate(`notifications.TITLES.${notification.category}`, { lang: language }) as string);
    return { title, body: written?.body ?? '' };
  }

  private async userLanguage(userId: string): Promise<PreferenceLanguage | null> {
    return (await this.preferencesService.getEntity(userId)).language ?? null;
  }
}
