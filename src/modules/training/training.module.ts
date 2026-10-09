import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { PreferencesModule } from '@/modules/users/preferences/preferences.module';
import { UsersModule } from '@/modules/users/users.module';

import { AdminTrainingController } from './admin-training.controller';
import { AdminTrainingService } from './admin-training.service';
import { AthleteProfileListener } from './athletes/athlete-profile.listener';
import { AthleteProfileService } from './athletes/athlete-profile.service';
import { AthletesController } from './athletes/athletes.controller';
import { AdaptationEvent } from './entities/adaptation-event.entity';
import { Athlete } from './entities/athlete.entity';
import { AthleteGoal } from './entities/athlete-goal.entity';
import { AthleteState } from './entities/athlete-state.entity';
import { Gear } from './entities/gear.entity';
import { RaceResult } from './entities/race-result.entity';
import { TrainingLoad } from './entities/training-load.entity';
import { TrainingPlan } from './entities/training-plan.entity';
import { Workout } from './entities/workout.entity';
import { GearController } from './gear/gear.controller';
import { GearListener } from './gear/gear.listener';
import { GearService } from './gear/gear.service';
import { PLAN_COMPLETION_QUEUE } from './jobs/plan-completion.constants';
import { PlanCompletionProcessor } from './jobs/plan-completion.processor';
import { PlanCompletionScheduler } from './jobs/plan-completion.scheduler';
import { AdminPlansController } from './plans/admin-plans.controller';
import { AdminPlansService } from './plans/admin-plans.service';
import { AthleteMetricsService } from './plans/athlete-metrics.service';
import { PlanChangeCalculator } from './plans/plan-change-calculator';
import { PlanEditingService } from './plans/plan-editing.service';
import { PlanLifecycleService } from './plans/plan-lifecycle.service';
import { PlanListService } from './plans/plan-list.service';
import { PlanRebuildService } from './plans/plan-rebuild.service';
import { PlanStatsService } from './plans/plan-stats.service';
import { PlansController } from './plans/plans.controller';
import { ProgressController } from './progress/progress.controller';
import { ProgressListener } from './progress/progress.listener';
import { ProgressService } from './progress/progress.service';
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
      Gear,
      RaceResult,
    ]),
    RealtimeModule,
    UsersModule,
    PreferencesModule,
    BullModule.registerQueue({
      name: PLAN_COMPLETION_QUEUE,
    }),
  ],
  // PlansController goes first: its static routes (`plans/active`, `plans/counts`)
  // must be registered before any parameterised `plans/:id` route; likewise
  // AthletesController (`athletes/me`) before TrainingController (`athletes/:id`).
  controllers: [
    PlansController,
    AthletesController,
    TrainingController,
    GearController,
    ProgressController,
    AdminTrainingController,
    AdminPlansController,
  ],
  providers: [
    AdminTrainingService,
    AdminPlansService,
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
    AthleteProfileService,
    AthleteProfileListener,
    GearService,
    GearListener,
    ProgressService,
    ProgressListener,
  ],
  exports: [TrainingService, AthleteProfileService, GearService],
})
export class TrainingModule {}
