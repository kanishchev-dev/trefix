import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { UsersModule } from '@/modules/users/users.module';

import { AdminTrainingController } from './admin-training.controller';
import { AdminTrainingService } from './admin-training.service';
import { AdaptationEvent } from './entities/adaptation-event.entity';
import { Athlete } from './entities/athlete.entity';
import { AthleteGoal } from './entities/athlete-goal.entity';
import { AthleteState } from './entities/athlete-state.entity';
import { TrainingLoad } from './entities/training-load.entity';
import { TrainingPlan } from './entities/training-plan.entity';
import { Workout } from './entities/workout.entity';
import { PLAN_COMPLETION_QUEUE } from './jobs/plan-completion.constants';
import { PlanCompletionProcessor } from './jobs/plan-completion.processor';
import { PlanCompletionScheduler } from './jobs/plan-completion.scheduler';
import { AthleteMetricsService } from './plans/athlete-metrics.service';
import { PlanChangeCalculator } from './plans/plan-change-calculator';
import { PlanEditingService } from './plans/plan-editing.service';
import { PlanLifecycleService } from './plans/plan-lifecycle.service';
import { PlanListService } from './plans/plan-list.service';
import { PlanRebuildService } from './plans/plan-rebuild.service';
import { PlanStatsService } from './plans/plan-stats.service';
import { PlansController } from './plans/plans.controller';
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
    UsersModule,
    BullModule.registerQueue({
      name: PLAN_COMPLETION_QUEUE,
    }),
  ],
  // PlansController goes first: its static routes (`plans/active`, `plans/counts`)
  // must be registered before any parameterised `plans/:id` route.
  controllers: [PlansController, TrainingController, AdminTrainingController],
  providers: [
    AdminTrainingService,
    TrainingService,
    TrainingEngine,
    TrainingListener,
    AthleteMetricsService,
    PlanStatsService,
    PlanLifecycleService,
    PlanChangeCalculator,
    PlanEditingService,
    PlanRebuildService,
    PlanListService,
    PlanCompletionProcessor,
    PlanCompletionScheduler,
  ],
  exports: [TrainingService],
})
export class TrainingModule {}
