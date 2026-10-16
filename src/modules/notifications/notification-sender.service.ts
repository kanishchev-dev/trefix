import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';

import { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';

import { NotificationDeliveryJob } from './delivery/notification-delivery.types';
import { Notification } from './entities/notification.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationCreatedEvent } from './events/notification.events';
import {
  NOTIFICATION_TYPES,
  type NotificationChannel,
  type NotificationContent,
  type NotificationDeliveryError,
  type NotificationLink,
  NOTIFICATIONS_DELIVER_JOB,
  NOTIFICATIONS_DELIVERY_QUEUE,
  type NotificationType,
} from './notifications.constants';
import { NOTIFICATIONS_EVENTS } from './notifications.events';
import { PushDevicesService } from './push/push-devices.service';

export interface NotifyInput {
  userId: string;
  type: NotificationType;
  content?: NotificationContent;
  params?: Record<string, string | number | boolean | null>;
  link?: NotificationLink | null;
  /** Overrides the default channels of the type (admin messages). */
  channels?: readonly NotificationChannel[];
  broadcastId?: string | null;
}

interface PlannedDelivery {
  channel: NotificationChannel;
  status: 'pending' | 'skipped';
  error: NotificationDeliveryError | null;
}

/**
 * The single entry point for sending notifications. Every notification lands
 * in the inbox; push and email are planned here and delivered by the queue.
 */
@Injectable()
export class NotificationSenderService {
  constructor(
    @InjectModel(Notification)
    private readonly notificationModel: typeof Notification,
    @InjectModel(NotificationDelivery)
    private readonly deliveryModel: typeof NotificationDelivery,
    @InjectQueue(NOTIFICATIONS_DELIVERY_QUEUE)
    private readonly queue: Queue<NotificationDeliveryJob>,
    private readonly preferencesService: UserPreferencesService,
    private readonly devicesService: PushDevicesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async notify(input: NotifyInput): Promise<Notification> {
    const [notification] = await this.notifyMany([input]);
    return notification;
  }

  /** Creates the notifications in one insert; used by broadcasts for batches of recipients. */
  async notifyMany(inputs: readonly NotifyInput[]): Promise<Notification[]> {
    if (inputs.length === 0) {
      return [];
    }
    const withDevices = await this.devicesService.usersWithDevices(inputs.map((input) => input.userId));
    const flagsOff = await this.disabledFlags(inputs);

    const notifications = await this.notificationModel.bulkCreate(
      inputs.map((input) => ({
        userId: input.userId,
        broadcastId: input.broadcastId ?? null,
        category: NOTIFICATION_TYPES[input.type].category,
        type: input.type,
        content: input.content ?? {},
        params: input.params ?? {},
        link: input.link ?? null,
      })),
    );

    const deliveryRows = notifications.flatMap((notification, index) =>
      this.planDeliveries(inputs[index], withDevices.has(notification.userId), flagsOff.has(notification.userId)).map(
        (planned) => ({ notificationId: notification.id, ...planned }),
      ),
    );
    const deliveries = deliveryRows.length > 0 ? await this.deliveryModel.bulkCreate(deliveryRows) : [];

    const pending = deliveries.filter((delivery) => delivery.status === 'pending');
    if (pending.length > 0) {
      await this.queue.addBulk(
        pending.map((delivery) => ({
          name: NOTIFICATIONS_DELIVER_JOB,
          data: { deliveryId: delivery.id },
          // The delivery id makes a re-enqueued job a no-op instead of a second push.
          opts: { jobId: `deliver:${delivery.id}` },
        })),
      );
    }

    for (const notification of notifications) {
      this.eventEmitter.emit(
        NOTIFICATIONS_EVENTS.CREATED,
        new NotificationCreatedEvent(
          notification.userId,
          notification.id,
          notification.category,
          notification.type,
          notification.broadcastId,
        ),
      );
    }
    return notifications;
  }

  private planDeliveries(input: NotifyInput, hasDevices: boolean, flagOff: boolean): PlannedDelivery[] {
    const channels = input.channels ?? NOTIFICATION_TYPES[input.type].defaultChannels;
    return [...new Set(channels)].map((channel) => {
      if (flagOff) {
        return { channel, status: 'skipped', error: 'preference_off' };
      }
      if (channel === 'push' && !hasDevices) {
        return { channel, status: 'skipped', error: 'no_devices' };
      }
      return { channel, status: 'pending', error: null };
    });
  }

  /** Users who switched off the setting that gates the notification type. */
  private async disabledFlags(inputs: readonly NotifyInput[]): Promise<Set<string>> {
    const off = new Set<string>();
    for (const input of inputs) {
      const flag = NOTIFICATION_TYPES[input.type].preferenceFlag as string | null;
      if (!flag) {
        continue;
      }
      const preferences = await this.preferencesService.getEntity(input.userId);
      const settings = this.preferencesService.notifications(preferences) as unknown as Record<string, unknown>;
      if (settings[flag] === false) {
        off.add(input.userId);
      }
    }
    return off;
  }
}
