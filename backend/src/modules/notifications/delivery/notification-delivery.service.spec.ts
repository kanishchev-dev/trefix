import type { ConfigService } from '@nestjs/config';
import type { Queue } from 'bullmq';
import type { I18nService } from 'nestjs-i18n';

import type { MailerService } from '@/modules/mailer/mailer.service';
import type { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';
import type { UsersService } from '@/modules/users/users.service';

import type { Notification } from '../entities/notification.entity';
import type { NotificationDelivery } from '../entities/notification-delivery.entity';
import type { ExpoPushClient } from '../push/expo-push.client';
import type { PushDevicesService } from '../push/push-devices.service';
import { NotificationDeliveryService } from './notification-delivery.service';
import type { NotificationDeliveryJob } from './notification-delivery.types';

describe('NotificationDeliveryService', () => {
  const now = new Date('2026-10-16T10:00:00Z');
  const notification = {
    id: 'n-1',
    userId: 'user-1',
    category: 'admin',
    type: 'admin.message',
    content: { ru: { title: null, body: 'Новая функция' }, en: { title: 'News', body: 'New feature' } },
    link: null,
  };

  const setup = (options: { tickets: unknown[]; language?: string | null; pushEnabled?: boolean }) => {
    const delivery = {
      id: 'd-1',
      notificationId: 'n-1',
      channel: 'push',
      status: 'pending',
      tickets: null as unknown,
      increment: jest.fn(),
      update: jest.fn(async function (this: Record<string, unknown>, values: Record<string, unknown>) {
        Object.assign(delivery, values);
      }),
    };
    const deliveryModel = { findByPk: jest.fn().mockResolvedValue(delivery), update: jest.fn() };
    const notificationModel = {
      findByPk: jest.fn().mockResolvedValue(notification),
      count: jest.fn().mockResolvedValue(2),
    };
    const queue = { add: jest.fn() };
    const devices = {
      list: jest.fn().mockResolvedValue([
        { id: 'dev-1', token: 'ExponentPushToken[a]', locale: 'en-US' },
        { id: 'dev-2', token: 'ExponentPushToken[b]', locale: 'ru-RU' },
      ]),
      removeNotRegistered: jest.fn(),
    };
    const push = { send: jest.fn().mockResolvedValue(options.tickets), receipts: jest.fn() };
    const preferences = { getEntity: jest.fn().mockResolvedValue({ language: options.language ?? null }) };
    const i18n = { translate: jest.fn((key: string, { lang }: { lang: string }) => `${key}:${lang}`) };
    const config = { get: jest.fn().mockReturnValue(options.pushEnabled ?? true) };
    const service = new NotificationDeliveryService(
      deliveryModel as unknown as typeof NotificationDelivery,
      notificationModel as unknown as typeof Notification,
      queue as unknown as Queue<NotificationDeliveryJob>,
      devices as unknown as PushDevicesService,
      push as unknown as ExpoPushClient,
      {} as MailerService,
      {} as UsersService,
      preferences as unknown as UserPreferencesService,
      i18n as unknown as I18nService,
      config as unknown as ConfigService,
    );
    return { service, delivery, devices, push, queue };
  };

  it('pushes each device in its language and schedules the receipt check', async () => {
    const { service, delivery, push, queue } = setup({
      tickets: [
        { status: 'ok', id: 't-1' },
        { status: 'ok', id: 't-2' },
      ],
    });

    await service.deliver('d-1', now);

    expect(push.send).toHaveBeenCalledWith([
      expect.objectContaining({ to: 'ExponentPushToken[a]', title: 'News', body: 'New feature', badge: 2 }),
      expect.objectContaining({
        to: 'ExponentPushToken[b]',
        title: 'notifications.TITLES.admin:ru',
        body: 'Новая функция',
      }),
    ]);
    expect(delivery.status).toBe('sent');
    expect(delivery.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'sent', sentAt: now }));
    expect(queue.add).toHaveBeenCalledWith(
      'notifications.receipts',
      { deliveryId: 'd-1' },
      expect.objectContaining({ jobId: 'receipts:d-1' }),
    );
  });

  it('removes devices Expo no longer knows and fails when none got the push', async () => {
    const { service, delivery, devices } = setup({
      language: 'ru',
      tickets: [
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
        { status: 'error', details: { error: 'DeviceNotRegistered' } },
      ],
    });

    await service.deliver('d-1', now);

    expect(devices.removeNotRegistered).toHaveBeenCalledWith(['dev-1', 'dev-2']);
    expect(delivery.status).toBe('failed');
    expect(delivery.update).toHaveBeenCalledWith(expect.objectContaining({ error: 'device_not_registered' }));
  });

  it('skips pushes where they are switched off', async () => {
    const { service, delivery, push } = setup({ tickets: [], pushEnabled: false });

    await service.deliver('d-1', now);

    expect(push.send).not.toHaveBeenCalled();
    expect(delivery.update).toHaveBeenCalledWith({ status: 'skipped', error: 'push_disabled' });
  });

  it('does nothing for a delivery that is no longer pending', async () => {
    const { service, delivery, push } = setup({ tickets: [] });
    delivery.status = 'sent';

    await service.deliver('d-1', now);

    expect(push.send).not.toHaveBeenCalled();
  });
});
