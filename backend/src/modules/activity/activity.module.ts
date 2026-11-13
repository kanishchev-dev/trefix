import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { SequelizeModule } from '@nestjs/sequelize';

import { DEFAULT_QUEUE_JOB_OPTIONS } from '@/common/constants/queue.constants';
import { TrainingModule } from '@/modules/training/training.module';
import { UsersModule } from '@/modules/users/users.module';

import { ACTIVITY_RETENTION_QUEUE, ACTIVITY_WRITE_QUEUE } from './activity.constants';
import { ActivityController } from './activity.controller';
import { ActivityListener } from './activity.listener';
import { ActivityService } from './activity.service';
import { ActivityContextInterceptor } from './activity-context.interceptor';
import { ActivityRetentionProcessor } from './activity-retention.processor';
import { ActivityRetentionScheduler } from './activity-retention.scheduler';
import { ActivityWriterProcessor } from './activity-writer.processor';
import { ActivityEvent } from './entities/activity-event.entity';

/**
 * Activity history: captures domain events with their actor and serves the
 * per-user history and the global log of the admin panel.
 */
@Module({
  imports: [
    SequelizeModule.forFeature([ActivityEvent]),
    BullModule.registerQueue(
      {
        name: ACTIVITY_WRITE_QUEUE,
        defaultJobOptions: {
          ...DEFAULT_QUEUE_JOB_OPTIONS,
          attempts: 5,
          removeOnComplete: true,
        },
      },
      { name: ACTIVITY_RETENTION_QUEUE, defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS },
    ),
    TrainingModule,
    UsersModule,
  ],
  controllers: [ActivityController],
  providers: [
    ActivityService,
    ActivityListener,
    ActivityWriterProcessor,
    ActivityRetentionProcessor,
    ActivityRetentionScheduler,
    { provide: APP_INTERCEPTOR, useClass: ActivityContextInterceptor },
  ],
  exports: [ActivityService],
})
export class ActivityModule {}
