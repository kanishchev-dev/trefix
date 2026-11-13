import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';

import { AdminWorkoutsService } from './admin-workouts.service';
import { CompleteWorkoutDto } from './dto/complete-workout.dto';
import {
  TrainingAdaptationListResponseDto,
  TrainingAdaptationResponseDto,
  TrainingWorkoutCompletionResponseDto,
  TrainingWorkoutResponseDto,
} from './dto/training-response.dto';
import {
  AssignWorkoutDeviceDto,
  AssignWorkoutGearDto,
  WorkoutDeviceAssignmentDto,
  WorkoutGearAssignmentDto,
} from './gear/dto/gear.dto';
import type { AdaptationEventView } from './interfaces/training-views.interface';
import { RecordsExclusionDto } from './progress/dto/progress.dto';
import { RecordsExclusionResponseDto } from './progress/dto/progress-response.dto';
import type { RecordsExclusionView } from './progress/progress.views';
import type { WorkoutCompletionResult } from './workouts/workouts.service';

/** One workout of any user and the pending adaptations of their plan, for the admin panel. */
@ApiTags('Admin Training Workouts')
@ApiBearerAuth()
@AdminEndpoint()
@ApiParam({ name: 'userId', format: 'uuid' })
@Controller({ path: 'users/:userId/training', version: '1' })
export class AdminWorkoutsController {
  constructor(private readonly adminWorkoutsService: AdminWorkoutsService) {}

  @Get('workouts/:workoutId')
  @RequirePermissions('training.calendar.read')
  @ApiOperation({ summary: 'Workout with its plan, actual result and analysis' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOkResponse({ type: TrainingWorkoutResponseDto })
  @ApiNotFoundResponse({ description: 'USER_NOT_FOUND, ATHLETE_NOT_FOUND, WORKOUT_NOT_FOUND' })
  getWorkout(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ): Promise<TrainingWorkoutResponseDto> {
    return this.adminWorkoutsService.getWorkout(userId, workoutId) as Promise<TrainingWorkoutResponseDto>;
  }

  @Post('workouts/:workoutId/complete')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('training.calendar.manage')
  @ApiOperation({ summary: 'Complete a workout with its actual result; a skipped workout can be completed too' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOkResponse({ type: TrainingWorkoutCompletionResponseDto })
  @ApiConflictResponse({ description: 'WORKOUT_CANCELLED' })
  complete(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Body() dto: CompleteWorkoutDto,
  ): Promise<WorkoutCompletionResult> {
    return this.adminWorkoutsService.complete(userId, workoutId, dto);
  }

  @Patch('workouts/:workoutId/result')
  @RequirePermissions('training.calendar.manage')
  @ApiOperation({ summary: 'Correct the actual result of a completed workout' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOkResponse({ type: TrainingWorkoutResponseDto })
  @ApiConflictResponse({ description: 'WORKOUT_NOT_COMPLETED' })
  updateResult(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Body() dto: CompleteWorkoutDto,
  ): Promise<TrainingWorkoutResponseDto> {
    return this.adminWorkoutsService.updateResult(userId, workoutId, dto) as Promise<TrainingWorkoutResponseDto>;
  }

  @Post('workouts/:workoutId/reopen')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('training.calendar.manage')
  @ApiOperation({ summary: 'Return a completed workout with a hand-entered result to planned' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOkResponse({ type: TrainingWorkoutResponseDto })
  @ApiConflictResponse({ description: 'WORKOUT_NOT_COMPLETED, WORKOUT_HAS_SOURCES' })
  reopen(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ): Promise<TrainingWorkoutResponseDto> {
    return this.adminWorkoutsService.reopen(userId, workoutId) as Promise<TrainingWorkoutResponseDto>;
  }

  @Delete('workouts/:workoutId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('training.calendar.manage')
  @ApiOperation({ summary: 'Delete a workout outside a plan, in any status' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'WORKOUT_BELONGS_TO_PLAN' })
  delete(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ): Promise<void> {
    return this.adminWorkoutsService.delete(userId, workoutId);
  }

  @Patch('workouts/:workoutId/gear')
  @RequirePermissions('training.calendar.manage')
  @ApiOperation({ summary: 'Set or clear the shoes of a workout' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOkResponse({ type: WorkoutGearAssignmentDto })
  setGear(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Body() dto: AssignWorkoutGearDto,
  ): Promise<{ workoutId: string; gearId: string | null }> {
    return this.adminWorkoutsService.setGear(userId, workoutId, dto.gearId ?? null);
  }

  @Patch('workouts/:workoutId/device')
  @RequirePermissions('training.calendar.manage')
  @ApiOperation({ summary: 'Set or clear the watch or sensor of a workout' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOkResponse({ type: WorkoutDeviceAssignmentDto })
  setDevice(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Body() dto: AssignWorkoutDeviceDto,
  ): Promise<{ workoutId: string; deviceId: string | null }> {
    return this.adminWorkoutsService.setDevice(userId, workoutId, dto.deviceId ?? null);
  }

  @Patch('workouts/:workoutId/records')
  @RequirePermissions('training.calendar.manage')
  @ApiOperation({ summary: 'Exclude the workout from records or include it back' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOkResponse({ type: RecordsExclusionResponseDto })
  setRecordsExcluded(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Body() dto: RecordsExclusionDto,
  ): Promise<RecordsExclusionView> {
    return this.adminWorkoutsService.setRecordsExcluded(userId, workoutId, dto.excluded);
  }

  @Get('plans/active/adaptations')
  @RequirePermissions('training.userplans.read')
  @ApiOperation({ summary: 'Adaptations of the active plan waiting for a decision or shown as advice' })
  @ApiOkResponse({ type: TrainingAdaptationListResponseDto })
  async listAdaptations(@Param('userId', ParseUUIDPipe) userId: string): Promise<TrainingAdaptationListResponseDto> {
    return { items: await this.adminWorkoutsService.listAdaptations(userId) } as TrainingAdaptationListResponseDto;
  }

  @Post('plans/active/adaptations/:adaptationId/apply')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('training.userplans.manage')
  @ApiOperation({ summary: 'Apply a proposed adaptation on behalf of the user' })
  @ApiParam({ name: 'adaptationId', format: 'uuid' })
  @ApiOkResponse({ type: TrainingAdaptationResponseDto })
  @ApiConflictResponse({ description: 'ADAPTATION_NOT_PROPOSED' })
  applyAdaptation(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('adaptationId', ParseUUIDPipe) adaptationId: string,
  ): Promise<AdaptationEventView> {
    return this.adminWorkoutsService.applyAdaptation(userId, adaptationId);
  }

  @Post('plans/active/adaptations/:adaptationId/dismiss')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('training.userplans.manage')
  @ApiOperation({ summary: 'Dismiss a pending adaptation on behalf of the user' })
  @ApiParam({ name: 'adaptationId', format: 'uuid' })
  @ApiOkResponse({ type: TrainingAdaptationResponseDto })
  dismissAdaptation(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('adaptationId', ParseUUIDPipe) adaptationId: string,
  ): Promise<AdaptationEventView> {
    return this.adminWorkoutsService.dismissAdaptation(userId, adaptationId);
  }
}
