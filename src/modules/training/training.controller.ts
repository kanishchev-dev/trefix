import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { AdaptPlanDto } from './dto/adapt-plan.dto';
import { AnalyzeWorkoutDto } from './dto/analyze-workout.dto';
import { CompleteWorkoutDto } from './dto/complete-workout.dto';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { ProgressSnapshotResponseDto } from './dto/progress-response.dto';
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
import { PlanOverviewResponseDto } from './dto/plan-overview-response.dto';
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

  @Get('athletes/me')
  @ApiOperation({ summary: 'Get the current user athlete profile' })
  @ApiOkResponse({
    description: 'Athlete profile',
    type: TrainingAthleteResponseDto,
    schema: { example: TRAINING_ATHLETE_EXAMPLE },
  })
  async getMyAthlete(@CurrentUser() user: AuthUserContext): Promise<TrainingAthleteResponseDto> {
    return this.trainingService.getOrCreateAthlete(user.id);
  }

  @Get('athletes/:id')
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
  @ApiOperation({ summary: 'Get the latest athlete state' })
  @ApiOkResponse({
    description: 'Latest athlete state',
    type: TrainingStateResponseDto,
    schema: { example: TRAINING_STATE_EXAMPLE },
  })
  async getAthleteState(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<TrainingStateResponseDto> {
    let targetId = id;
    if (id === 'me') {
      const athlete = await this.trainingService.getOrCreateAthlete(user.id);
      targetId = athlete.id;
    }
    return this.trainingService.getAthleteState(targetId, user.id);
  }

  @Get('progress')
  @ApiOperation({ summary: 'Get progress snapshot for current athlete' })
  @ApiOkResponse({
    description: 'Progress snapshot',
    type: ProgressSnapshotResponseDto,
  })
  async getProgress(
    @CurrentUser() user: AuthUserContext,
    @Query('period') period?: string,
  ): Promise<ProgressSnapshotResponseDto> {
    return this.trainingService.getProgressSnapshot(user.id, period);
  }

  @Post('goals')
  @ApiOperation({ summary: 'Create a running goal' })
  @ApiCreatedResponse({
    description: 'Goal created',
    type: TrainingGoalResponseDto,
    schema: { example: TRAINING_GOAL_EXAMPLE },
  })
  createGoal(@CurrentUser() user: AuthUserContext, @Body() dto: CreateGoalDto): Promise<TrainingGoalResponseDto> {
    return this.trainingService.createGoal(user.id, dto);
  }

  @Get('goals/:id')
  @ApiOperation({ summary: 'Get a running goal' })
  @ApiOkResponse({
    description: 'Running goal',
    type: TrainingGoalResponseDto,
    schema: { example: TRAINING_GOAL_EXAMPLE },
  })
  getGoal(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<TrainingGoalResponseDto> {
    return this.trainingService.getGoal(id, user.id);
  }

  @Post('plans')
  @ApiOperation({ summary: 'Generate a training plan' })
  @ApiCreatedResponse({
    description: 'Training plan created',
    type: TrainingPlanResponseDto,
    schema: { example: TRAINING_PLAN_EXAMPLE },
  })
  createPlan(@CurrentUser() user: AuthUserContext, @Body() dto: CreatePlanDto): Promise<TrainingPlanResponseDto> {
    return this.trainingService.createPlan(user.id, dto);
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get a training plan' })
  @ApiOkResponse({
    description: 'Training plan',
    type: TrainingPlanResponseDto,
    schema: { example: TRAINING_PLAN_EXAMPLE },
  })
  getPlan(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<TrainingPlanResponseDto> {
    return this.trainingService.getPlan(id, user.id);
  }

  @Get('plans/:id/overview')
  @ApiOperation({ summary: 'Get a training plan overview for the mobile UI' })
  @ApiOkResponse({
    description: 'Training plan overview',
    type: PlanOverviewResponseDto,
  })
  getPlanOverview(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<PlanOverviewResponseDto> {
    return this.trainingService.getPlanOverview(id, user.id);
  }

  @Post('plans/:id/regenerate')
  @ApiOperation({ summary: 'Regenerate a training plan' })
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

  @Get('workouts/:id')
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
