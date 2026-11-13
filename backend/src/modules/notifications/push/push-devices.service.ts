import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { PushDevice } from '../entities/push-device.entity';
import { PushDeviceEvent } from '../events/notification.events';
import type { PushPlatform } from '../notifications.constants';
import { NOTIFICATIONS_EVENTS } from '../notifications.events';

export interface RegisterPushDeviceInput {
  token: string;
  platform: PushPlatform;
  locale?: string | null;
  appVersion?: string | null;
  deviceName?: string | null;
}

/** App installations that receive pushes. */
@Injectable()
export class PushDevicesService {
  constructor(
    @InjectModel(PushDevice)
    private readonly deviceModel: typeof PushDevice,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Registers the token for the signed-in session. A token belongs to one
   * installation, so registering it again moves it to the current user and
   * session (another account signed in on the same phone).
   */
  async register(
    userId: string,
    sessionId: string,
    input: RegisterPushDeviceInput,
    now = new Date(),
  ): Promise<PushDevice> {
    const existing = await this.deviceModel.findOne({ where: { token: input.token } });
    const values = {
      userId,
      sessionId,
      platform: input.platform,
      locale: input.locale ?? null,
      appVersion: input.appVersion ?? null,
      deviceName: input.deviceName ?? null,
      lastSeenAt: now,
    };
    if (existing) {
      const isNew = existing.userId !== userId;
      await existing.update(values);
      if (isNew) {
        this.emit(existing, 'registered');
      }
      return existing;
    }
    const device = await this.deviceModel.create({ ...values, token: input.token });
    this.emit(device, 'registered');
    return device;
  }

  /** The app unregisters on sign-out or when the user turns notifications off in the system. */
  async unregister(userId: string, token: string): Promise<void> {
    const device = await this.deviceModel.findOne({ where: { userId, token } });
    if (device) {
      await device.destroy();
      this.emit(device, 'unregistered');
    }
  }

  async removeBySession(sessionId: string): Promise<void> {
    const devices = await this.deviceModel.findAll({ where: { sessionId } });
    for (const device of devices) {
      await device.destroy();
      this.emit(device, 'signed_out');
    }
  }

  /** Tokens Expo reported as no longer valid (app removed, push permission revoked). */
  async removeNotRegistered(deviceIds: string[]): Promise<void> {
    if (deviceIds.length === 0) {
      return;
    }
    const devices = await this.deviceModel.findAll({ where: { id: { [Op.in]: deviceIds } } });
    for (const device of devices) {
      await device.destroy();
      this.emit(device, 'not_registered');
    }
  }

  list(userId: string): Promise<PushDevice[]> {
    return this.deviceModel.findAll({ where: { userId }, order: [['lastSeenAt', 'DESC']] });
  }

  /** Users among `userIds` with at least one device. */
  async usersWithDevices(userIds: readonly string[]): Promise<Set<string>> {
    if (userIds.length === 0) {
      return new Set();
    }
    const rows = await this.deviceModel.findAll({
      where: { userId: { [Op.in]: [...userIds] } },
      attributes: ['userId'],
      group: ['userId'],
    });
    return new Set(rows.map((row) => row.userId));
  }

  /** Users with a device of one of the platforms (segment filter). */
  async usersByPlatforms(platforms: readonly PushPlatform[]): Promise<Set<string>> {
    const rows = await this.deviceModel.findAll({
      where: { platform: { [Op.in]: [...platforms] } },
      attributes: ['userId'],
      group: ['userId'],
    });
    return new Set(rows.map((row) => row.userId));
  }

  private emit(device: PushDevice, reason: PushDeviceEvent['reason']): void {
    const event =
      reason === 'registered' ? NOTIFICATIONS_EVENTS.DEVICE_REGISTERED : NOTIFICATIONS_EVENTS.DEVICE_REMOVED;
    this.eventEmitter.emit(event, new PushDeviceEvent(device.userId, device.id, device.platform, reason));
  }
}
