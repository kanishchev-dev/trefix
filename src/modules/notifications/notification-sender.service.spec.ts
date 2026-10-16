import type { Queue } from 'bullmq';

import type { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';

import type { NotificationDeliveryJob } from './delivery/notification-delivery.types';
import type { Notification } from './entities/notification.entity';
import type { NotificationDelivery } from './entities/notification-delivery.entity';
import { NotificationSenderService } from './notification-sender.service';
import type { PushDevicesService } from './push/push-devices.service';

describe('NotificationSenderService', () => {
  const setup = (usersWithDevices: string[]) => {
    let nextId = 0;
    const notificationModel = {
      bulkCreate: jest.fn(async (rows: Array<Record<string, unknown>>) =>
        rows.map((row) => ({ ...row, id: `n-${++nextId}` })),
      ),
    };
    const deliveryModel = {
      bulkCreate: jest.fn(async (rows: Array<Record<string, unknown>>) =>
        rows.map((row, index) => ({ ...row, id: `d-${index + 1}` })),
      ),
    };
    const queue = { addBulk: jest.fn() };
    const preferences = { getEntity: jest.fn(), notifications: jest.fn() };
    const devices = { usersWithDevices: jest.fn().mockResolvedValue(new Set(usersWithDevices)) };
    const events = { emit: jest.fn() };
    const service = new NotificationSenderService(
      notificationModel as unknown as typeof Notification,
      deliveryModel as unknown as typeof NotificationDelivery,
      queue as unknown as Queue<NotificationDeliveryJob>,
      preferences as unknown as UserPreferencesService,
      devices as unknown as PushDevicesService,
      events as never,
    );
    return { service, notificationModel, deliveryModel, queue, events };
  };

  it('stores the coach message in the inbox and queues a push for a user with a device', async () => {
    const { service, notificationModel, deliveryModel, queue, events } = setup(['user-1']);

    await service.notify({
      userId: 'user-1',
      type: 'coach.message',
      content: { ru: { body: 'Пора менять кроссовки' } },
      link: { target: 'coach', id: 'session-1' },
    });

    expect(notificationModel.bulkCreate).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'user-1', category: 'coach', type: 'coach.message' }),
    ]);
    expect(deliveryModel.bulkCreate).toHaveBeenCalledWith([
      { notificationId: 'n-1', channel: 'push', status: 'pending', error: null },
    ]);
    expect(queue.addBulk).toHaveBeenCalledWith([
      expect.objectContaining({ data: { deliveryId: 'd-1' }, opts: { jobId: 'deliver:d-1' } }),
    ]);
    expect(events.emit).toHaveBeenCalledWith(
      'notifications.created',
      expect.objectContaining({ userId: 'user-1', notificationId: 'n-1' }),
    );
  });

  it('skips the push when the user has no device but still sends the email', async () => {
    const { service, deliveryModel, queue } = setup([]);

    await service.notify({
      userId: 'user-2',
      type: 'admin.message',
      content: { en: { title: 'Hello', body: 'Text' } },
      channels: ['push', 'email'],
    });

    expect(deliveryModel.bulkCreate).toHaveBeenCalledWith([
      { notificationId: 'n-1', channel: 'push', status: 'skipped', error: 'no_devices' },
      { notificationId: 'n-1', channel: 'email', status: 'pending', error: null },
    ]);
    expect(queue.addBulk).toHaveBeenCalledWith([expect.objectContaining({ data: { deliveryId: 'd-2' } })]);
  });

  it('keeps an inbox-only admin message without deliveries', async () => {
    const { service, deliveryModel, queue } = setup(['user-3']);

    await service.notify({ userId: 'user-3', type: 'admin.message', content: { ru: { body: 'Текст' } }, channels: [] });

    expect(deliveryModel.bulkCreate).not.toHaveBeenCalled();
    expect(queue.addBulk).not.toHaveBeenCalled();
  });
});
