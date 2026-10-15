import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';

import { DEFAULT_QUEUE_JOB_OPTIONS } from '@/common/constants/queue.constants';
import { RealtimeModule } from '@/modules/realtime/realtime.module';
import { PreferencesModule } from '@/modules/users/preferences/preferences.module';
import { UsersModule } from '@/modules/users/users.module';

import { AdaptationsService } from './adaptations/adaptations.service';
import { HeartRateTargetsService } from './adaptations/heart-rate-targets.service';
import { PlanAdaptationApplier } from './adaptations/plan-adaptation-applier';
import { AdminTrainingController } from './admin-training.controller';
import { AdminTrainingService } from './admin-training.service';
import { AthleteProfileListener } from './athletes/athlete-profile.listener';
import { AthleteProfileService } from './athletes/athlete-profile.service';
import { AthleteStateService } from './athletes/athlete-state.service';
import { AthletesController } from './athletes/athletes.controller';
import { AthletesService } from './athletes/athletes.service';
import { AdaptationEvent } from './entities/adaptation-event.entity';
import { Athlete } from './entities/athlete.entity';
import { AthleteGoal } from './entities/athlete-goal.entity';
import { AthleteState } from './entities/athlete-state.entity';
import { Gear } from './entities/gear.entity';
import { RaceResult } from './entities/race-result.entity';
import { TrainingLoad } from './entities/training-load.entity';
import { TrainingPlan } from './entities/training-plan.entity';
import { Workout } from './entities/workout.entity';
import { WorkoutExecutionBuilder } from './execution/workout-execution.builder';
import { WorkoutExecutionController } from './execution/workout-execution.controller';
import { GearController } from './gear/gear.controller';
import { GearListener } from './gear/gear.listener';
import { GearService } from './gear/gear.service';
import { GoalsService } from './goals/goals.service';
import { PLAN_COMPLETION_QUEUE } from './jobs/plan-completion.constants';
import { PlanCompletionProcessor } from './jobs/plan-completion.processor';
import { PlanCompletionScheduler } from './jobs/plan-completion.scheduler';
import { AdminPlansController } from './plans/admin-plans.controller';
import { AdminPlansService } from './plans/admin-plans.service';
import { AthleteMetricsService } from './plans/athlete-metrics.service';
import { PlanChangeCalculator } from './plans/plan-change-calculator';
import { PlanEditingService } from './plans/plan-editing.service';
import { PlanGenerationService } from './plans/plan-generation.service';
import { PlanLifecycleService } from './plans/plan-lifecycle.service';
import { PlanListService } from './plans/plan-list.service';
import { PlanMaterializer } from './plans/plan-materializer.service';
import { PlanQueryService } from './plans/plan-query.service';
import { PlanRebuildService } from './plans/plan-rebuild.service';
import { PlanRegenerationService } from './plans/plan-regeneration.service';
import { PlanStartOptionsService } from './plans/plan-start-options.service';
import { PlanStatsService } from './plans/plan-stats.service';
import { PlansController } from './plans/plans.controller';
import { ProgressController } from './progress/progress.controller';
import { ProgressListener } from './progress/progress.listener';
import { ProgressService } from './progress/progress.service';
import { ProgressSummaryService } from './progress/progress-summary.service';
import { TrainingController } from './training.controller';
import { TrainingEngine } from './training.engine';
import { TrainingListener } from './training.listener';
import { TrainingLookupService } from './training-lookup.service';
import { ImportedWorkoutLookupService } from './workouts/imported-workout-lookup.service';
import { ManualWorkoutsService } from './workouts/manual-workouts.service';
import { WorkoutImportService } from './workouts/workout-import.service';
import { WorkoutsService } from './workouts/workouts.service';

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
      defaultJobOptions: DEFAULT_QUEUE_JOB_OPTIONS,
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
    WorkoutExecutionController,
    AdminTrainingController,
    AdminPlansController,
  ],
  providers: [
    AdminTrainingService,
    AdminPlansService,
    TrainingLookupService,
    AthleteStateService,
    AthletesService,
    GoalsService,
    PlanQueryService,
    PlanGenerationService,
    PlanRegenerationService,
    WorkoutsService,
    ManualWorkoutsService,
    WorkoutImportService,
    ImportedWorkoutLookupService,
    PlanAdaptationApplier,
    AdaptationsService,
    HeartRateTargetsService,
    TrainingEngine,
    TrainingListener,
    AthleteMetricsService,
    PlanStatsService,
    PlanLifecycleService,
    PlanMaterializer,
    PlanStartOptionsService,
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
    ProgressSummaryService,
    ProgressListener,
    WorkoutExecutionBuilder,
  ],
  // Public contract of the training module; other modules never touch its models.
  exports: [
    AthletesService,
    GoalsService,
    PlanQueryService,
    WorkoutsService,
    AdaptationsService,
    WorkoutImportService,
    ImportedWorkoutLookupService,
    AthleteProfileService,
    GearService,
  ],
})
export class TrainingModule {}
