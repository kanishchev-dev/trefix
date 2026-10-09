import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { AdaptPlanDto } from './dto/adapt-plan.dto';
import { AnalyzeWorkoutDto } from './dto/analyze-workout.dto';
import { CompleteWorkoutDto } from './dto/complete-workout.dto';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreateManualPlanDto, PreviewManualPlanDto } from './dto/create-manual-plan.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { ManualPlanPreviewResponseDto } from './dto/manual-plan-preview-response.dto';
import { PlanOverviewResponseDto } from './dto/plan-overview-response.dto';
import { RegeneratePlanDto } from './dto/regenerate-plan.dto';
import {
  TrainingAdaptationResponseDto,
  TrainingAthleteResponseDto,
  TrainingGoalResponseDto,
  TrainingPlanResponseDto,
  TrainingStateResponseDto,
  TrainingWorkoutAnalysisResponseDto,
  TrainingWorkoutCompletionResponseDto,
  TrainingWorkoutResponseDto,
} from './dto/training-response.dto';
import { CurrentMetrics } from './plans/athlete-metrics.service';
import { PLAN_CREATE_THROTTLE } from './plans/plan-create-throttle';
import {
  TRAINING_ADAPTATION_EXAMPLE,
  TRAINING_ATHLETE_EXAMPLE,
  TRAINING_GOAL_EXAMPLE,
  TRAINING_PLAN_EXAMPLE,
  TRAINING_STATE_EXAMPLE,
  TRAINING_WORKOUT_COMPLETION_EXAMPLE,
  TRAINING_WORKOUT_EXAMPLE,
} from './training.openapi';
import { TrainingService } from './training.service';

@ApiTags('Training')
@ApiBearerAuth()
@Controller({
  path: '',
  version: '1',
})
export class TrainingController {
  constructor(private readonly trainingService: TrainingService) {}

  @Post('athletes')
  @RequirePermissions('training.athletes.create')
  @ApiOperation({ summary: 'Create an athlete profile' })
  @ApiCreatedResponse({
    description: 'Athlete profile created',
    type: TrainingAthleteResponseDto,
    schema: { example: TRAINING_ATHLETE_EXAMPLE },
  })
  createAthlete(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: CreateAthleteDto,
  ): Promise<TrainingAthleteResponseDto> {
    return this.trainingService.createAthlete(user.id, dto);
  }

  @Get('athletes/:id')
  @RequirePermissions('training.athletes.read')
  @ApiOperation({ summary: 'Get an athlete profile' })
  @ApiOkResponse({
    description: 'Athlete profile',
    type: TrainingAthleteResponseDto,
    schema: { example: TRAINING_ATHLETE_EXAMPLE },
  })
  async getAthlete(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<TrainingAthleteResponseDto> {
    if (id === 'me') {
      return this.trainingService.getOrCreateAthlete(user.id);
    }
    return this.trainingService.getAthlete(id, user.id);
  }

  @Get('athletes/:id/state')
  @RequirePermissions('training.athletes.read')
  @ApiOperation({ summary: 'Get the latest athlete state' })
  @ApiOkResponse({
    description: 'Latest athlete state',
    type: TrainingStateResponseDto,
    schema: { example: TRAINING_STATE_EXAMPLE },
  })
  async getAthleteState(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
  ): Promise<TrainingStateResponseDto> {
    let targetId = id;
    if (id === 'me') {
      const athlete = await this.trainingService.getOrCreateAthlete(user.id);
      targetId = athlete.id;
    }
    return this.trainingService.getAthleteState(targetId, user.id);
  }

  @Post('goals')
  @RequirePermissions('training.goals.create')
  @ApiOperation({ summary: 'Create a universal training goal (polymorphic by goal.type)' })
  @ApiCreatedResponse({
    description: 'Goal created',
    type: TrainingGoalResponseDto,
    schema: { example: TRAINING_GOAL_EXAMPLE },
  })
  createGoal(@CurrentUser() user: AuthUserContext, @Body() dto: CreateGoalDto): Promise<TrainingGoalResponseDto> {
    return this.trainingService.createGoal(user.id, dto);
  }

  @Get('goals/:id')
  @RequirePermissions('training.goals.read')
  @ApiOperation({ summary: 'Get a running goal' })
  @ApiOkResponse({
    description: 'Running goal',
    type: TrainingGoalResponseDto,
    schema: { example: TRAINING_GOAL_EXAMPLE },
  })
  getGoal(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<TrainingGoalResponseDto> {
    return this.trainingService.getGoal(id, user.id);
  }

  @Post('plans/manual/preview')
  @RequirePermissions('training.plans.create')
  @ApiOperation({ summary: 'Preview a manually configured training plan (not persisted)' })
  @ApiOkResponse({
    description: 'Manual plan preview structure',
    type: ManualPlanPreviewResponseDto,
  })
  previewManualPlan(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: PreviewManualPlanDto,
  ): Promise<ManualPlanPreviewResponseDto> {
    return this.trainingService.previewManualPlan(user.id, dto);
  }

  @Post('plans/manual')
  @Throttle(PLAN_CREATE_THROTTLE)
  @RequirePermissions('training.plans.create')
  @ApiOperation({ summary: 'Create a training plan from a manual configuration' })
  @ApiCreatedResponse({
    description: 'Training plan created from the manual configuration',
    type: TrainingPlanResponseDto,
  })
  createManualPlan(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: CreateManualPlanDto,
  ): Promise<TrainingPlanResponseDto> {
    return this.trainingService.createManualPlan(user.id, dto);
  }

  @Post('plans')
  @Throttle(PLAN_CREATE_THROTTLE)
  @RequirePermissions('training.plans.create')
  @ApiOperation({ summary: 'Generate a training plan' })
  @ApiCreatedResponse({
    description: 'Training plan created',
    type: TrainingPlanResponseDto,
    schema: { example: TRAINING_PLAN_EXAMPLE },
  })
  createPlan(@CurrentUser() user: AuthUserContext, @Body() dto: CreatePlanDto): Promise<TrainingPlanResponseDto> {
    return this.trainingService.createPlan(user.id, dto);
  }

  @Get('plans/:id/overview')
  @RequirePermissions('training.plans.read')
  @ApiOperation({ summary: 'Get a training plan overview for the mobile UI' })
  @ApiOkResponse({
    description: 'Training plan overview',
    type: PlanOverviewResponseDto,
  })
  getPlanOverview(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<PlanOverviewResponseDto> {
    return this.trainingService.getPlanOverview(id, user.id);
  }

  @Post('plans/:id/regenerate')
  @RequirePermissions('training.plans.update')
  @ApiOperation({ summary: 'Regenerate a training plan (deprecated: use plan editing endpoints)', deprecated: true })
  @ApiOkResponse({
    description: 'Regenerated training plan',
    type: TrainingPlanResponseDto,
    schema: { example: TRAINING_PLAN_EXAMPLE },
  })
  regeneratePlan(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: RegeneratePlanDto,
  ): Promise<TrainingPlanResponseDto> {
    return this.trainingService.regeneratePlan(user.id, id, dto.startDate);
  }

  @Get('workouts')
  @RequirePermissions('training.workouts.read')
  @ApiOperation({ summary: 'List workouts for a date range (cancelled excluded by default)' })
  @ApiOkResponse({
    description: 'Workouts list',
    type: [TrainingWorkoutResponseDto],
  })
  getWorkouts(
    @CurrentUser() user: AuthUserContext,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('includeCancelled') includeCancelled?: string,
  ): Promise<TrainingWorkoutResponseDto[]> {
    return this.trainingService.listWorkoutsForDateRange(user.id, from, to, includeCancelled === 'true');
  }

  @Get('athletes/me/current-metrics')
  @RequirePermissions('training.athletes.read')
  @ApiOperation({ summary: 'Current metrics estimate with per-field sources, for the plan creation prefill' })
  @ApiOkResponse({
    description:
      'Each field is `{ value, source }`; source is profile | strava | manual_workouts | athlete_state | none',
  })
  getCurrentMetrics(@CurrentUser() user: AuthUserContext): Promise<CurrentMetrics> {
    return this.trainingService.getCurrentMetrics(user.id);
  }

  @Post('workouts')
  @RequirePermissions('training.workouts.create')
  @ApiOperation({ summary: 'Create or log a workout' })
  @ApiCreatedResponse({
    description: 'Workout created',
    type: TrainingWorkoutResponseDto,
  })
  createWorkout(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: CreateWorkoutDto,
  ): Promise<TrainingWorkoutResponseDto> {
    return this.trainingService.createWorkout(user.id, dto);
  }

  @Get('workouts/:id')
  @RequirePermissions('training.workouts.read')
  @ApiOperation({ summary: 'Get a workout' })
  @ApiOkResponse({
    description: 'Workout',
    type: TrainingWorkoutResponseDto,
    schema: { example: TRAINING_WORKOUT_EXAMPLE },
  })
  getWorkout(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<TrainingWorkoutResponseDto> {
    return this.trainingService.getWorkout(id, user.id);
  }

  @Post('workouts/:id/complete')
  @RequirePermissions('training.workouts.update')
  @ApiOperation({ summary: 'Complete a workout' })
  @ApiOkResponse({
    description: 'Completed workout',
    type: TrainingWorkoutCompletionResponseDto,
    schema: { example: TRAINING_WORKOUT_COMPLETION_EXAMPLE },
  })
  completeWorkout(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: CompleteWorkoutDto,
  ): Promise<TrainingWorkoutCompletionResponseDto> {
    return this.trainingService.completeWorkout(user.id, id, dto);
  }

  @Post('training/analyze')
  @RequirePermissions('training.analyze')
  @ApiOperation({ summary: 'Analyze a workout' })
  @ApiOkResponse({
    description: 'Workout analysis',
    type: TrainingWorkoutAnalysisResponseDto,
    schema: { example: TRAINING_WORKOUT_COMPLETION_EXAMPLE.analysis },
  })
  analyzeWorkout(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: AnalyzeWorkoutDto,
  ): Promise<TrainingWorkoutAnalysisResponseDto> {
    return this.trainingService.analyzeWorkout(user.id, dto);
  }

  @Post('training/adapt')
  @RequirePermissions('training.adapt')
  @ApiOperation({ summary: 'Adapt a training plan' })
  @ApiOkResponse({
    description: 'Adaptation decision',
    type: TrainingAdaptationResponseDto,
    schema: { example: TRAINING_ADAPTATION_EXAMPLE },
  })
  adaptPlan(@CurrentUser() user: AuthUserContext, @Body() dto: AdaptPlanDto): Promise<TrainingAdaptationResponseDto> {
    return this.trainingService.adaptPlan(user.id, dto);
  }
}
