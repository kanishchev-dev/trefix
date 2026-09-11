import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { TrainingModule } from '@/modules/training/training.module';

import { OpenAiModule } from '../openai/openai.module';
import { CoachController } from './coach.controller';
import { CoachListener } from './coach.listener';
import { CoachPromptBuilder } from './coach.prompt';
import { CoachService } from './coach.service';
import { CoachToolRunner } from './coach.tool-runner';
import { CoachMessage } from './entities/coach-message.entity';
import { CoachSession } from './entities/coach-session.entity';

@Module({
  imports: [SequelizeModule.forFeature([CoachSession, CoachMessage]), TrainingModule, OpenAiModule, RealtimeModule],
  controllers: [CoachController],
  providers: [CoachService, CoachPromptBuilder, CoachToolRunner, CoachListener],
  exports: [CoachService],
})
export class CoachModule {}
