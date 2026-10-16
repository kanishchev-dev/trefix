import { Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { LogDataAccess } from '@/common/decorators/log-data-access.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { QueuedResponseDto, SuccessResponseDto } from '@/common/dto/status-response.dto';

import { AdminIntegrationsService } from './admin-integrations.service';
import { WorkoutSourcesResponseDto } from './device/dto/device-sync-status.dto';
import { IntegrationsListResponseDto } from './dto/integration-response.dto';
import { IntegrationSyncStatusResponseDto } from './dto/sync-status-response.dto';
import { WorkoutRecordingResponseDto } from './recordings/dto/recorded-activity.dto';

export class DeviceSyncRequestResponseDto {
  @ApiProperty({ description: 'Whether the app was online to receive the request' })
  delivered!: boolean;
}

/** Integrations, workout sources and recorded tracks of any user, for the admin panel. */
@ApiTags('Admin Integrations')
@ApiBearerAuth()
@AdminEndpoint()
@ApiParam({ name: 'userId', format: 'uuid' })
@Controller({ path: 'users/:userId', version: '1' })
export class AdminIntegrationsController {
  constructor(private readonly adminIntegrationsService: AdminIntegrationsService) {}

  @Get('integrations')
  @RequirePermissions('integrations.users.read')
  @ApiOperation({ summary: 'Every provider with its connection status' })
  @ApiOkResponse({ type: IntegrationsListResponseDto })
  list(@Param('userId', ParseUUIDPipe) userId: string): Promise<IntegrationsListResponseDto> {
    return this.adminIntegrationsService.list(userId);
  }

  @Post('integrations/strava/sync')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('integrations.users.manage')
  @ApiOperation({ summary: 'Sync Strava activities of the user now', description: 'Errors: STRAVA_NOT_CONNECTED' })
  @ApiOkResponse({ type: IntegrationSyncStatusResponseDto })
  syncStrava(@Param('userId', ParseUUIDPipe) userId: string): Promise<IntegrationSyncStatusResponseDto> {
    return this.adminIntegrationsService.syncStrava(userId);
  }

  @Post('integrations/strava/profile-sync')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('integrations.users.manage')
  @ApiOperation({
    summary: 'Sync weight, sex and shoes from Strava now',
    description: 'Errors: STRAVA_NOT_CONNECTED, STRAVA_PROFILE_ACCESS_REQUIRED',
  })
  @ApiAcceptedResponse({ type: QueuedResponseDto })
  syncStravaProfile(@Param('userId', ParseUUIDPipe) userId: string): Promise<{ status: 'queued' }> {
    return this.adminIntegrationsService.syncStravaProfile(userId);
  }

  @Post('integrations/:provider/sync-request')
  @HttpCode(HttpStatus.ACCEPTED)
  @RequirePermissions('integrations.users.manage')
  @ApiParam({ name: 'provider', enum: ['apple_health', 'health_connect'] })
  @ApiOperation({ summary: 'Ask the app to sync Health data in the background' })
  @ApiAcceptedResponse({ type: DeviceSyncRequestResponseDto })
  requestDeviceSync(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('provider') provider: string,
  ): Promise<DeviceSyncRequestResponseDto> {
    return this.adminIntegrationsService.requestDeviceSync(userId, provider);
  }

  @Delete('integrations/:provider')
  @RequirePermissions('integrations.users.manage')
  @ApiParam({ name: 'provider', enum: ['strava', 'apple_health', 'health_connect'] })
  @ApiOperation({ summary: 'Disconnect a provider; imported workouts stay' })
  @ApiOkResponse({ type: SuccessResponseDto })
  disconnect(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('provider') provider: string,
  ): Promise<{ success: boolean }> {
    return this.adminIntegrationsService.disconnect(userId, provider);
  }

  @Get('training/workouts/:workoutId/sources')
  @RequirePermissions('training.calendar.read')
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOperation({ summary: 'Provider records the workout was built from, primary first' })
  @ApiOkResponse({ type: WorkoutSourcesResponseDto })
  listWorkoutSources(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ): Promise<WorkoutSourcesResponseDto> {
    return this.adminIntegrationsService.listWorkoutSources(userId, workoutId);
  }

  @Delete('training/workouts/:workoutId/sources/:provider')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('training.calendar.manage')
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiParam({ name: 'provider', example: 'strava' })
  @ApiOperation({ summary: 'Detach a provider record from the workout' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'WORKOUT_SOURCE_NOT_FOUND' })
  unlinkWorkoutSource(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
    @Param('provider') provider: string,
  ): Promise<void> {
    return this.adminIntegrationsService.unlinkWorkoutSource(userId, workoutId, provider);
  }

  @Get('training/workouts/:workoutId/recording')
  @RequirePermissions('training.calendar.read')
  @LogDataAccess({ resource: 'workout.recording', resourceParam: 'workoutId' })
  @ApiParam({ name: 'workoutId', format: 'uuid' })
  @ApiOperation({ summary: 'Route and splits of a workout recorded in the app; the view is logged' })
  @ApiOkResponse({ type: WorkoutRecordingResponseDto })
  getRecording(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ): Promise<WorkoutRecordingResponseDto> {
    return this.adminIntegrationsService.getRecording(userId, workoutId);
  }
}
