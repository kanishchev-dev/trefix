import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RealtimeService } from '@/modules/realtime/realtime.service';

import { PermissionCreatedEvent } from '../events/permission-created.event';
import { PermissionDeletedEvent } from '../events/permission-deleted.event';
import { PermissionGroupCreatedEvent } from '../events/permission-group-created.event';
import { PermissionGroupDeletedEvent } from '../events/permission-group-deleted.event';
import { PermissionGroupUpdatedEvent } from '../events/permission-group-updated.event';
import { PermissionUpdatedEvent } from '../events/permission-updated.event';
import { UserPermissionsUpdatedEvent } from '../events/user-permissions-updated.event';

@Injectable()
export class PermissionsListener {
  private readonly logger = new Logger(PermissionsListener.name);

  constructor(private readonly realtimeService: RealtimeService) {}

  @OnEvent('permission.created')
  handlePermissionCreated(event: PermissionCreatedEvent): void {
    this.logger.log(`Permission created: ${event.name} (${event.id})`);
    this.realtimeService.emitToRoom('permissions', 'permission.created', event);
  }

  @OnEvent('permission.updated')
  handlePermissionUpdated(event: PermissionUpdatedEvent): void {
    this.logger.log(`Permission updated: ${event.name} (${event.id})`);
    this.realtimeService.emitToRoom('permissions', 'permission.updated', event);
  }

  @OnEvent('permission.deleted')
  handlePermissionDeleted(event: PermissionDeletedEvent): void {
    this.logger.log(`Permission deleted: ${event.name} (${event.id})`);
    this.realtimeService.emitToRoom('permissions', 'permission.deleted', event);
  }

  @OnEvent('permission-group.created')
  handlePermissionGroupCreated(event: PermissionGroupCreatedEvent): void {
    this.logger.log(`Permission group created: ${event.name} (${event.id})`);
    this.realtimeService.emitToRoom('permissions', 'permission-group.created', event);
  }

  @OnEvent('permission-group.updated')
  handlePermissionGroupUpdated(event: PermissionGroupUpdatedEvent): void {
    this.logger.log(`Permission group ${event.action}: ${event.name} (${event.groupId})`);
    this.realtimeService.emitToRoom('permissions', 'permission-group.updated', event);
  }

  @OnEvent('permission-group.deleted')
  handlePermissionGroupDeleted(event: PermissionGroupDeletedEvent): void {
    this.logger.log(`Permission group deleted: ${event.name} (${event.id})`);
    this.realtimeService.emitToRoom('permissions', 'permission-group.deleted', event);
  }

  @OnEvent('user-permissions.updated')
  handleUserPermissionsUpdated(event: UserPermissionsUpdatedEvent): void {
    this.logger.log(`User permissions updated for ${event.userId}: ${event.action} -> ${event.targetId}`);
    this.realtimeService.emitToUser(event.userId, 'user-permissions.updated', event);
    this.realtimeService.emitToRoom('permissions', 'user-permissions.updated', event);
  }
}
