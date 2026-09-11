import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { RealtimeModule } from '@/modules/realtime/realtime.module';

import { AdaptationEvent } from './entities/adaptation-event.entity';
import { Athlete } from './entities/athlete.entity';
import { AthleteGoal } from './entities/athlete-goal.entity';
import { AthleteState } from './entities/athlete-state.entity';
import { TrainingLoad } from './entities/training-load.entity';
import { TrainingPlan } from './entities/training-plan.entity';
import { Workout } from './entities/workout.entity';
import { TrainingController } from './training.controller';
import { TrainingEngine } from './training.engine';
import { TrainingListener } from './training.listener';
import { TrainingService } from './training.service';

@Module({
  imports: [
    SequelizeModule.forFeature([
      Athlete,
      AthleteGoal,
      AthleteState,
      TrainingPlan,
      Workout,
      TrainingLoad,
      AdaptationEvent,
    ]),
    RealtimeModule,
  ],
  controllers: [TrainingController],
  providers: [TrainingService, TrainingEngine, TrainingListener],
  exports: [TrainingService],
})
export class TrainingModule {}
