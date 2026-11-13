import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PermissionCreatedEvent } from '@/modules/permissions/events/permission-created.event';
import { PermissionDeletedEvent } from '@/modules/permissions/events/permission-deleted.event';
import { PermissionGroupCreatedEvent } from '@/modules/permissions/events/permission-group-created.event';
import { PermissionGroupDeletedEvent } from '@/modules/permissions/events/permission-group-deleted.event';
import { PermissionGroupUpdatedEvent } from '@/modules/permissions/events/permission-group-updated.event';
import { PermissionUpdatedEvent } from '@/modules/permissions/events/permission-updated.event';
import { UserPermissionsUpdatedEvent } from '@/modules/permissions/events/user-permissions-updated.event';
import { PERMISSIONS_EVENTS } from '@/modules/permissions/permissions.events';

import { RealtimeService } from '../realtime.service';

/**
 * Pushes permission catalog and grant changes to the admin panel.
 * Lives in the realtime module so permissions does not depend on realtime.
 */
@Injectable()
export class PermissionsRealtimeListener {
  private readonly logger = new Logger(PermissionsRealtimeListener.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  @OnEvent(PERMISSIONS_EVENTS.PERMISSION_CREATED)
  handlePermissionCreated(event: PermissionCreatedEvent): void {
    this.logger.log(`Permission created: ${event.name} (${event.id})`);
    this.realtimeService.emitToRoom('permissions', 'permission.created', event);
  }

  @OnEvent(PERMISSIONS_EVENTS.PERMISSION_UPDATED)
  handlePermissionUpdated(event: PermissionUpdatedEvent): void {
    this.logger.log(`Permission updated: ${event.name} (${event.id})`);
    this.realtimeService.emitToRoom('permissions', 'permission.updated', event);
  }

  @OnEvent(PERMISSIONS_EVENTS.PERMISSION_DELETED)
  handlePermissionDeleted(event: PermissionDeletedEvent): void {
    this.logger.log(`Permission deleted: ${event.name} (${event.id})`);
    this.realtimeService.emitToRoom('permissions', 'permission.deleted', event);
  }

  @OnEvent(PERMISSIONS_EVENTS.GROUP_CREATED)
  handlePermissionGroupCreated(event: PermissionGroupCreatedEvent): void {
    this.logger.log(`Permission group created: ${event.name} (${event.id})`);
    this.realtimeService.emitToRoom('permissions', 'permission-group.created', event);
  }

  @OnEvent(PERMISSIONS_EVENTS.GROUP_UPDATED)
  handlePermissionGroupUpdated(event: PermissionGroupUpdatedEvent): void {
    this.logger.log(`Permission group ${event.action}: ${event.name} (${event.groupId})`);
    this.realtimeService.emitToRoom('permissions', 'permission-group.updated', event);
  }

  @OnEvent(PERMISSIONS_EVENTS.GROUP_DELETED)
  handlePermissionGroupDeleted(event: PermissionGroupDeletedEvent): void {
    this.logger.log(`Permission group deleted: ${event.name} (${event.id})`);
    this.realtimeService.emitToRoom('permissions', 'permission-group.deleted', event);
  }

  @OnEvent(PERMISSIONS_EVENTS.USER_PERMISSIONS_UPDATED)
  handleUserPermissionsUpdated(event: UserPermissionsUpdatedEvent): void {
    this.logger.log(`User permissions updated for ${event.userId}: ${event.action} -> ${event.targetId}`);
    this.realtimeService.emitToUser(event.userId, 'user-permissions.updated', event);
    this.realtimeService.emitToRoom('permissions', 'user-permissions.updated', event);
  }
}
