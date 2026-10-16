import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { LogDataAccess } from '@/common/decorators/log-data-access.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';

import { AdminCoachNoteListResponseDto, AdminCoachSessionListResponseDto } from './admin-coach.dto';
import { AdminCoachService } from './admin-coach.service';
import { CoachSessionDetailResponseDto } from './dto/coach-response.dto';
import { CoachWorkoutNoteResponseDto } from './dto/coach-workout-note-response.dto';

/** AI coach conversations and workout notes of any user, for the admin panel. */
@ApiTags('Admin Coach')
@ApiBearerAuth()
@AdminEndpoint()
@ApiParam({ name: 'userId', format: 'uuid' })
@Controller({ path: 'users/:userId', version: '1' })
export class AdminCoachController {
  constructor(private readonly adminCoachService: AdminCoachService) {}

  @Get('coach/sessions')
  @RequirePermissions('coach.users.read')
  @ApiOperation({ summary: 'Chat sessions with titles and message counts, without their text' })
  @ApiOkResponse({ type: AdminCoachSessionListResponseDto })
  listSessions(@Param('userId', ParseUUIDPipe) userId: string): Promise<AdminCoachSessionListResponseDto> {
    return this.adminCoachService.listSessions(userId);
  }

  @Get('coach/sessions/:sessionId')
  @RequirePermissions('coach.conversations.read')
  @LogDataAccess({ resource: 'coach.conversation', resourceParam: 'sessionId' })
  @ApiOperation({ summary: 'Messages of a chat session; every view is logged' })
  @ApiParam({ name: 'sessionId', format: 'uuid' })
  @ApiOkResponse({ type: CoachSessionDetailResponseDto })
  getSession(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('sessionId', ParseUUIDPipe) sessionId: string,
  ): Promise<CoachSessionDetailResponseDto> {
    return this.adminCoachService.getSession(userId, sessionId);
  }

  @Delete('coach/sessions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('coach.users.manage')
  @ApiOperation({ summary: 'Delete the whole chat history of the user' })
  @ApiNoContentResponse()
  clearHistory(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.adminCoachService.clearHistory(userId);
  }

  @Get('coach/workout-notes')
  @RequirePermissions('coach.users.read')
  @ApiOperation({ summary: 'Workout notes the coach wrote, newest first' })
  @ApiOkResponse({ type: AdminCoachNoteListResponseDto })
  listNotes(@Param('userId', ParseUUIDPipe) userId: string): Promise<AdminCoachNoteListResponseDto> {
    return this.adminCoachService.listNotes(userId);
  }

  @Get('training/workouts/:workoutId/note')
  @RequirePermissions('coach.users.read')
  @ApiOperation({ summary: 'The coach note of a workout; scheduled when missing' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOkResponse({ type: CoachWorkoutNoteResponseDto })
  getNote(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ): Promise<CoachWorkoutNoteResponseDto> {
    return this.adminCoachService.getNote(userId, workoutId);
  }

  @Post('training/workouts/:workoutId/note/regenerate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('coach.users.manage')
  @ApiOperation({ summary: 'Write the coach note again' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOkResponse({ type: CoachWorkoutNoteResponseDto })
  regenerateNote(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ): Promise<CoachWorkoutNoteResponseDto> {
    return this.adminCoachService.regenerateNote(userId, workoutId);
  }

  @Delete('training/workouts/:workoutId/note')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('coach.users.manage')
  @ApiOperation({ summary: 'Delete the coach note of a workout' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiNoContentResponse()
  deleteNote(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ): Promise<void> {
    return this.adminCoachService.deleteNote(userId, workoutId);
  }
}
