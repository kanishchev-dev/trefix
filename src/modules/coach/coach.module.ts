import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { DEFAULT_QUEUE_JOB_OPTIONS } from '@/common/constants/queue.constants';
import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { TrainingModule } from '@/modules/training/training.module';
import { PreferencesModule } from '@/modules/users/preferences/preferences.module';

import { OpenAiModule } from '../openai/openai.module';
import { CoachController } from './coach.controller';
import { CoachListener } from './coach.listener';
import { CoachPromptBuilder } from './coach.prompt';
import { CoachService } from './coach.service';
import { CoachToolRunner } from './coach.tool-runner';
import { CoachConversationService } from './coach-conversation.service';
import { CoachStreamService } from './coach-stream.service';
import { CoachMessage } from './entities/coach-message.entity';
import { CoachSession } from './entities/coach-session.entity';
import { CoachMessageTexts } from './proactive/coach-message-texts';
import { COACH_PROACTIVE_QUEUE } from './proactive/coach-proactive.constants';
import { CoachProactiveListener } from './proactive/coach-proactive.listener';
import { CoachProactiveProcessor } from './proactive/coach-proactive.processor';
import { CoachProactiveService } from './proactive/coach-proactive.service';

@Module({
  imports: [
    SequelizeModule.forFeature([CoachSession, CoachMessage]),
    TrainingModule,
    OpenAiModule,
    RealtimeModule,
    PreferencesModule,
    BullModule.registerQueue({ name: COACH_PROACTIVE_QUEUE, defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS }),
  ],
  controllers: [CoachController],
  providers: [
    CoachService,
    CoachConversationService,
    CoachStreamService,
    CoachPromptBuilder,
    CoachToolRunner,
    CoachListener,
    CoachProactiveService,
    CoachMessageTexts,
    CoachProactiveProcessor,
    CoachProactiveListener,
  ],
  exports: [CoachService],
})
export class CoachModule {}
