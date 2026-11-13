import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { ApiPaginatedResponse } from '@/common/swagger/api-paginated-response.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import {
  MarkNotificationsReadDto,
  NotificationListQueryDto,
  NotificationResponseDto,
  NotificationUnreadCountResponseDto,
  PushDeviceResponseDto,
  RegisterPushDeviceDto,
  UnregisterPushDeviceDto,
} from './dto/notification.dto';
import { NotificationsService } from './notifications.service';
import { PushDevicesService } from './push/push-devices.service';
import { requestLanguage } from './request-language';

/** The inbox of the signed-in user and the push devices of their app. */
@ApiTags('Notifications')
@ApiBearerAuth()
@Controller({ path: 'notifications', version: '1' })
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly devicesService: PushDevicesService,
  ) {}

  @Get()
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'Own notifications, newest first; texts in the request language' })
  @ApiPaginatedResponse(NotificationResponseDto)
  list(
    @CurrentUser() user: AuthUserContext,
    @Query() query: NotificationListQueryDto,
  ): Promise<PaginatedResponseDto<NotificationResponseDto>> {
    return this.notificationsService.list(user.id, query, requestLanguage());
  }

  @Get('unread-count')
  @RequirePermissions('notifications.read')
  @ApiOperation({ summary: 'Number of unread notifications, for the badge' })
  @ApiOkResponse({ type: NotificationUnreadCountResponseDto })
  async unreadCount(@CurrentUser() user: AuthUserContext): Promise<NotificationUnreadCountResponseDto> {
    return { count: await this.notificationsService.unreadCount(user.id) };
  }

  @Post('read')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('notifications.manage')
  @ApiOperation({ summary: 'Mark notifications as read; returns the new unread count' })
  @ApiOkResponse({ type: NotificationUnreadCountResponseDto })
  async markRead(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: MarkNotificationsReadDto,
  ): Promise<NotificationUnreadCountResponseDto> {
    return { count: await this.notificationsService.markRead(user.id, dto.ids) };
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('notifications.manage')
  @ApiOperation({ summary: 'Mark every notification as read' })
  @ApiOkResponse({ type: NotificationUnreadCountResponseDto })
  async markAllRead(@CurrentUser() user: AuthUserContext): Promise<NotificationUnreadCountResponseDto> {
    return { count: await this.notificationsService.markAllRead(user.id) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('notifications.manage')
  @ApiOperation({ summary: 'Remove a notification from the inbox', description: 'Errors: NOTIFICATION_NOT_FOUND' })
  @ApiNoContentResponse()
  async remove(@CurrentUser() user: AuthUserContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.notificationsService.remove(user.id, id);
  }

  @Put('devices')
  @RequirePermissions('notifications.manage')
  @ApiOperation({
    summary: 'Register the push token of this app installation',
    description: 'Called on every app start; the device is bound to the current session and removed on sign-out.',
  })
  @ApiOkResponse({ type: PushDeviceResponseDto })
  async registerDevice(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: RegisterPushDeviceDto,
  ): Promise<PushDeviceResponseDto> {
    return toDeviceResponse(await this.devicesService.register(user.id, user.sessionId, dto));
  }

  @Post('devices/unregister')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('notifications.manage')
  @ApiOperation({ summary: 'Stop sending pushes to this installation' })
  @ApiNoContentResponse()
  async unregisterDevice(@CurrentUser() user: AuthUserContext, @Body() dto: UnregisterPushDeviceDto): Promise<void> {
    await this.devicesService.unregister(user.id, dto.token);
  }
}

export function toDeviceResponse(device: {
  id: string;
  platform: PushDeviceResponseDto['platform'];
  locale: string | null;
  appVersion: string | null;
  deviceName: string | null;
  lastSeenAt: Date;
  createdAt: Date;
}): PushDeviceResponseDto {
  return {
    id: device.id,
    platform: device.platform,
    locale: device.locale,
    appVersion: device.appVersion,
    deviceName: device.deviceName,
    lastSeenAt: device.lastSeenAt,
    createdAt: device.createdAt,
  };
}
