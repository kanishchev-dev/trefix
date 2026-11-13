import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { ApiPaginatedResponse } from '@/common/swagger/api-paginated-response.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { BroadcastsService } from '../broadcasts/broadcasts.service';
import {
  AudiencePreviewDto,
  AudiencePreviewResponseDto,
  BroadcastListQueryDto,
  BroadcastRecipientResponseDto,
  BroadcastResponseDto,
  CreateBroadcastDto,
} from '../dto/broadcast.dto';
import {
  AdminNotificationListQueryDto,
  AdminNotificationResponseDto,
  NotificationListQueryDto,
  PushDeviceListResponseDto,
} from '../dto/notification.dto';
import { toDeviceResponse } from '../notifications.controller';
import { NotificationsService } from '../notifications.service';
import { PushDevicesService } from '../push/push-devices.service';
import { requestLanguage } from '../request-language';

/** Admin broadcasts: sending to one user, a group, a segment or everyone, and their delivery. */
@ApiTags('Admin Notifications')
@ApiBearerAuth()
@AdminEndpoint()
@Controller({ path: 'notification-broadcasts', version: '1' })
export class AdminBroadcastsController {
  constructor(private readonly broadcastsService: BroadcastsService) {}

  @Get()
  @RequirePermissions('notifications.broadcasts.read')
  @ApiOperation({ summary: 'Sent broadcasts with delivery stats, newest first' })
  @ApiPaginatedResponse(BroadcastResponseDto)
  list(@Query() query: BroadcastListQueryDto): Promise<PaginatedResponseDto<BroadcastResponseDto>> {
    return this.broadcastsService.list(query);
  }

  @Get(':id')
  @RequirePermissions('notifications.broadcasts.read')
  @ApiOperation({ summary: 'A broadcast with delivery stats', description: 'Errors: NOTIFICATION_BROADCAST_NOT_FOUND' })
  @ApiOkResponse({ type: BroadcastResponseDto })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<BroadcastResponseDto> {
    return this.broadcastsService.get(id);
  }

  @Get(':id/recipients')
  @RequirePermissions('notifications.broadcasts.read')
  @ApiOperation({ summary: 'Recipients of a broadcast with read and delivery status' })
  @ApiPaginatedResponse(BroadcastRecipientResponseDto)
  recipients(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: NotificationListQueryDto,
  ): Promise<PaginatedResponseDto<BroadcastRecipientResponseDto>> {
    return this.broadcastsService.recipients(id, query);
  }

  @Post('audience-preview')
  @RequirePermissions('notifications.broadcasts.send')
  @ApiOperation({ summary: 'How many active accounts an audience reaches, and how many of them have push' })
  @ApiOkResponse({ type: AudiencePreviewResponseDto })
  preview(@Body() dto: AudiencePreviewDto): Promise<AudiencePreviewResponseDto> {
    return this.broadcastsService.preview(dto.audience);
  }

  @Post()
  @RequirePermissions('notifications.broadcasts.send')
  @ApiOperation({
    summary: 'Send a notification; delivery runs in the background',
    description:
      'Errors: NOTIFICATION_CONTENT_REQUIRED, NOTIFICATION_LINK_URL_REQUIRED, NOTIFICATION_AUDIENCE_EMPTY, PERMISSION_GROUP_NOT_FOUND',
  })
  @ApiCreatedResponse({ type: BroadcastResponseDto })
  create(@CurrentUser() user: AuthUserContext, @Body() dto: CreateBroadcastDto): Promise<BroadcastResponseDto> {
    return this.broadcastsService.create(user.id, dto);
  }
}

/** Notifications and push devices of any user, for the user card. */
@ApiTags('Admin Notifications')
@ApiBearerAuth()
@AdminEndpoint()
@ApiParam({ name: 'userId', format: 'uuid' })
@Controller({ path: 'users/:userId/notifications', version: '1' })
export class AdminUserNotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly devicesService: PushDevicesService,
  ) {}

  @Get()
  @RequirePermissions('notifications.users.read')
  @ApiOperation({ summary: 'Inbox of the user with delivery status per channel' })
  @ApiPaginatedResponse(AdminNotificationResponseDto)
  list(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: AdminNotificationListQueryDto,
  ): Promise<PaginatedResponseDto<AdminNotificationResponseDto>> {
    return this.notificationsService.listForAdmin(userId, query, requestLanguage());
  }

  @Get('devices')
  @RequirePermissions('notifications.users.read')
  @ApiOperation({ summary: 'App installations of the user that receive pushes' })
  @ApiOkResponse({ type: PushDeviceListResponseDto })
  async devices(@Param('userId', ParseUUIDPipe) userId: string): Promise<PushDeviceListResponseDto> {
    return { items: (await this.devicesService.list(userId)).map(toDeviceResponse) };
  }
}
