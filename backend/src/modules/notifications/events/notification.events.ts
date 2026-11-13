import type {
  BroadcastAudienceType,
  BroadcastStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationType,
  PushPlatform,
} from '../notifications.constants';

export class NotificationCreatedEvent {
  constructor(
    public readonly userId: string,
    public readonly notificationId: string,
    public readonly category: NotificationCategory,
    public readonly type: NotificationType,
    public readonly broadcastId: string | null,
  ) {}
}

/** `notificationIds` is empty when the user marked everything as read. */
export class NotificationsReadEvent {
  constructor(
    public readonly userId: string,
    public readonly notificationIds: string[],
    public readonly all: boolean,
  ) {}
}

export class NotificationDeletedEvent {
  constructor(
    public readonly userId: string,
    public readonly notificationId: string,
  ) {}
}

export class PushDeviceEvent {
  constructor(
    public readonly userId: string,
    public readonly deviceId: string,
    public readonly platform: PushPlatform,
    public readonly reason: 'registered' | 'signed_out' | 'unregistered' | 'not_registered',
  ) {}
}

export class BroadcastCreatedEvent {
  constructor(
    public readonly broadcastId: string,
    public readonly createdBy: string | null,
    public readonly audienceType: BroadcastAudienceType,
    public readonly channels: NotificationChannel[],
    /** Set when the broadcast goes to exactly one user, so it lands in that user's history. */
    public readonly singleUserId: string | null,
  ) {}
}

export class BroadcastCompletedEvent {
  constructor(
    public readonly broadcastId: string,
    public readonly status: BroadcastStatus,
    public readonly recipientsCount: number,
  ) {}
}
