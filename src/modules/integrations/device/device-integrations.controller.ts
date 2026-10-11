import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiAcceptedResponse, ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { DeviceConnectionsService } from '@/modules/integrations/device/device-connections.service';
import { DeviceProfileMetricsService } from '@/modules/integrations/device/device-profile-metrics.service';
import { DeviceSyncService } from '@/modules/integrations/device/device-sync.service';

import { AuthUserContext } from '../../auth/interfaces/auth-user-context.interface';
import { DEVICE_PROVIDERS, DEVICE_SYNC_RATE_LIMIT } from '../constants/integrations.constants';
import { IntegrationItemResponseDto } from '../dto/integration-response.dto';
import { DeviceConnectionDto, UpdateDeviceConnectionDto } from './dto/device-connection.dto';
import { DeviceProfileMetricsDto, DeviceProfileMetricsResultDto } from './dto/device-profile-metrics.dto';
import { DeviceSyncBatchAcceptedDto, DeviceSyncBatchDto } from './dto/device-sync-batch.dto';
import { DeviceSyncStatusResponseDto, WorkoutSourcesResponseDto } from './dto/device-sync-status.dto';

const providerParam = { name: 'provider', enum: DEVICE_PROVIDERS };

/**
 * Apple Health / Health Connect. Registered after `IntegrationsController`
 * so its static `strava/*` routes win over `:provider/*`.
 */
@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('integrations')
export class DeviceIntegrationsController {
  constructor(
    private readonly deviceConnections: DeviceConnectionsService,
    private readonly deviceProfileMetrics: DeviceProfileMetricsService,
    private readonly deviceSync: DeviceSyncService,
  ) {}

  @Get('workouts/:workoutId/sources')
  @RequirePermissions('integrations.read')
  @ApiOperation({ summary: 'Provider records a workout was built from, primary first' })
  @ApiOkResponse({ type: WorkoutSourcesResponseDto })
  listWorkoutSources(
    @CurrentUser() user: AuthUserContext,
    @Param('workoutId', ParseUUIDPipe) workoutId: string,
  ): Promise<WorkoutSourcesResponseDto> {
    return this.deviceConnections.listWorkoutSources(user.id, workoutId);
  }

  @Put(':provider/connection')
  @RequirePermissions('integrations.sync')
  @ApiParam(providerParam)
  @ApiOperation({ summary: 'Connect Apple Health / Health Connect after the user granted access on the device' })
  @ApiOkResponse({ type: IntegrationItemResponseDto })
  connect(
    @CurrentUser() user: AuthUserContext,
    @Param('provider') provider: string,
    @Body() dto: DeviceConnectionDto,
  ): Promise<IntegrationItemResponseDto> {
    return this.deviceConnections.connect(user.id, provider, dto);
  }

  @Patch(':provider/connection')
  @RequirePermissions('integrations.sync')
  @ApiParam(providerParam)
  @ApiOperation({ summary: 'Update granted scopes, profile sync flag or app version' })
  @ApiOkResponse({ type: IntegrationItemResponseDto })
  updateConnection(
    @CurrentUser() user: AuthUserContext,
    @Param('provider') provider: string,
    @Body() dto: UpdateDeviceConnectionDto,
  ): Promise<IntegrationItemResponseDto> {
    return this.deviceConnections.updateConnection(user.id, provider, dto);
  }

  @Delete(':provider')
  @RequirePermissions('integrations.delete')
  @ApiParam(providerParam)
  @ApiOperation({
    summary: 'Disconnect; imported workouts stay, device access is revoked by the user in system settings',
  })
  @ApiOkResponse({ schema: { example: { success: true } } })
  disconnect(@CurrentUser() user: AuthUserContext, @Param('provider') provider: string): Promise<{ success: boolean }> {
    return this.deviceConnections.disconnect(user.id, provider);
  }

  @Post(':provider/sync-batches')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: DEVICE_SYNC_RATE_LIMIT })
  @RequirePermissions('integrations.sync')
  @ApiParam(providerParam)
  @ApiOperation({
    summary: 'Accept a batch of runs read on the device',
    description:
      'Idempotent by (syncId, batchIndex). 202 means the batch is stored and the app may move its sync cursor; ' +
      'invalid items are returned in `rejected` and do not fail the batch.',
  })
  @ApiAcceptedResponse({ type: DeviceSyncBatchAcceptedDto })
  acceptBatch(
    @CurrentUser() user: AuthUserContext,
    @Param('provider') provider: string,
    @Body() dto: DeviceSyncBatchDto,
  ): Promise<DeviceSyncBatchAcceptedDto> {
    return this.deviceSync.acceptBatch(user.id, provider, dto);
  }

  @Get(':provider/sync')
  @RequirePermissions('integrations.read')
  @ApiParam(providerParam)
  @ApiOperation({ summary: 'Status and outcomes of the latest sync session' })
  @ApiOkResponse({ type: DeviceSyncStatusResponseDto })
  getSyncStatus(
    @CurrentUser() user: AuthUserContext,
    @Param('provider') provider: string,
  ): Promise<DeviceSyncStatusResponseDto> {
    return this.deviceSync.getSyncStatus(user.id, provider);
  }

  @Post(':provider/profile-metrics')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('integrations.sync')
  @ApiParam(providerParam)
  @ApiOperation({
    summary: 'Weight and daily resting HR from Health for the athlete profile',
    description: 'Manual values are never overwritten; Strava and Health compete by measurement time.',
  })
  @ApiOkResponse({ type: DeviceProfileMetricsResultDto })
  applyProfileMetrics(
    @CurrentUser() user: AuthUserContext,
    @Param('provider') provider: string,
    @Body() dto: DeviceProfileMetricsDto,
  ): Promise<DeviceProfileMetricsResultDto> {
    return this.deviceProfileMetrics.applyProfileMetrics(user.id, provider, dto);
  }
}
