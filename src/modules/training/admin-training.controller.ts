import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { AdminTrainingService } from './admin-training.service';
import {
  AdminCalendarDayQueryDto,
  AdminCalendarDayResponseDto,
  AdminCalendarSummaryQueryDto,
  AdminCalendarSummaryResponseDto,
  AdminWorkoutCreateDto,
  AdminWorkoutMutationResponseDto,
  AdminWorkoutUpdateDto,
} from './dto/admin-calendar.dto';
import {
  AdminCalendarDayView,
  AdminCalendarSummaryView,
  AdminWorkoutMutationView,
} from './interfaces/admin-calendar-views.interface';

/**
 * Admin-panel workout calendar of a single user. Lives in the training module
 * because every workout rule lives here; guarded by dedicated admin
 * permissions that the default user group does not get.
 */
@ApiTags('Admin Training Calendar')
@ApiBearerAuth()
@ApiParam({ name: 'userId', format: 'uuid', description: 'User whose calendar is managed' })
@Controller({ path: 'users/:userId/training', version: '1' })
export class AdminTrainingController {
  constructor(private readonly adminTrainingService: AdminTrainingService) {}

  @Get('calendar/summary')
  @RequirePermissions('training.calendar.read')
  @ApiOperation({ summary: 'Per-day workout counts of a local date range (month grid markers)' })
  @ApiOkResponse({ type: AdminCalendarSummaryResponseDto })
  @ApiNotFoundResponse({ description: 'USER_NOT_FOUND' })
  getCalendarSummary(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: AdminCalendarSummaryQueryDto,
  ): Promise<AdminCalendarSummaryView> {
    return this.adminTrainingService.summarizeRange(userId, query);
  }

  @Get('calendar')
  @RequirePermissions('training.calendar.read')
  @ApiOperation({ summary: 'Workouts of one local calendar day of the user' })
  @ApiOkResponse({ type: AdminCalendarDayResponseDto })
  @ApiNotFoundResponse({ description: 'USER_NOT_FOUND' })
  getCalendarDay(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: AdminCalendarDayQueryDto,
  ): Promise<AdminCalendarDayView> {
    return this.adminTrainingService.listWorkoutsForDay(userId, query);
  }

  @Post('workouts')
  @RequirePermissions('training.calendar.manage')
  @ApiOperation({ summary: 'Add a standalone workout to the user calendar; past dates allowed' })
  @ApiCreatedResponse({ type: AdminWorkoutMutationResponseDto })
  @ApiNotFoundResponse({ description: 'USER_NOT_FOUND, ATHLETE_NOT_FOUND' })
  createWorkout(
    @CurrentUser() actor: AuthUserContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: AdminWorkoutCreateDto,
  ): Promise<AdminWorkoutMutationView> {
    return this.adminTrainingService.createWorkout(actor.id, userId, dto);
  }

  @Patch('workouts/:workoutId')
  @RequirePermissions('training.calendar.manage')
  @ApiOperation({ summary: 'Edit the planned attributes of a user workout' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOkResponse({ type: AdminWorkoutMutationResponseDto })
  @ApiNotFoundResponse({ description: 'USER_NOT_FOUND, ATHLETE_NOT_FOUND, WORKOUT_NOT_FOUND' })
  @ApiConflictResponse({ description: 'WORKOUT_COMPLETED_IMMUTABLE' })
  updateWorkout(
    @CurrentUser() actor: AuthUserContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Body() dto: AdminWorkoutUpdateDto,
  ): Promise<AdminWorkoutMutationView> {
    return this.adminTrainingService.updateWorkout(actor.id, userId, workoutId, dto);
  }
}
