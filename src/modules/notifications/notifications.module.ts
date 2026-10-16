import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { DEFAULT_QUEUE_JOB_OPTIONS } from '@/common/constants/queue.constants';
import { MailerModule } from '@/modules/mailer/mailer.module';
import { PermissionsModule } from '@/modules/permissions/permissions.module';
import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { TrainingModule } from '@/modules/training/training.module';
import { PreferencesModule } from '@/modules/users/preferences/preferences.module';
import { UsersModule } from '@/modules/users/users.module';

import { AdminBroadcastsController, AdminUserNotificationsController } from './admin/admin-notifications.controller';
import { AudienceResolverService } from './broadcasts/audience-resolver.service';
import { BroadcastProcessor } from './broadcasts/broadcast.processor';
import { BroadcastsService } from './broadcasts/broadcasts.service';
import { NotificationDeliveryProcessor } from './delivery/notification-delivery.processor';
import { NotificationDeliveryService } from './delivery/notification-delivery.service';
import { Notification } from './entities/notification.entity';
import { NotificationBroadcast } from './entities/notification-broadcast.entity';
import { NotificationDelivery } from './entities/notification-delivery.entity';
import { PushDevice } from './entities/push-device.entity';
import { NotificationsListener } from './listeners/notifications.listener';
import { NotificationSenderService } from './notification-sender.service';
import {
  NOTIFICATIONS_BROADCAST_QUEUE,
  NOTIFICATIONS_DELIVERY_QUEUE,
  NOTIFICATIONS_RETENTION_QUEUE,
} from './notifications.constants';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsRetentionProcessor, NotificationsRetentionScheduler } from './notifications-retention';
import { ExpoPushClient } from './push/expo-push.client';
import { PushDevicesService } from './push/push-devices.service';

@Module({
  imports: [
    SequelizeModule.forFeature([Notification, NotificationDelivery, NotificationBroadcast, PushDevice]),
    BullModule.registerQueue(
      {
        name: NOTIFICATIONS_DELIVERY_QUEUE,
        defaultJobOptions: {
          ...DEFAULT_QUEUE_JOB_OPTIONS,
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      },
      { name: NOTIFICATIONS_BROADCAST_QUEUE, defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS },
      { name: NOTIFICATIONS_RETENTION_QUEUE, defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS },
    ),
    UsersModule,
    PermissionsModule,
    PreferencesModule,
    TrainingModule,
    MailerModule,
    RealtimeModule,
  ],
  controllers: [NotificationsController, AdminBroadcastsController, AdminUserNotificationsController],
  providers: [
    NotificationsService,
    NotificationSenderService,
    NotificationDeliveryService,
    NotificationDeliveryProcessor,
    PushDevicesService,
    ExpoPushClient,
    AudienceResolverService,
    BroadcastsService,
    BroadcastProcessor,
    NotificationsListener,
    NotificationsRetentionScheduler,
    NotificationsRetentionProcessor,
  ],
  exports: [NotificationSenderService],
})
export class NotificationsModule {}
