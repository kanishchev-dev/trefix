import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

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

  @OnEvent('permission.created')
  handlePermissionCreated(event: PermissionCreatedEvent): void {
    this.logger.log(`Permission created: ${event.name} (${event.id})`);
  }

  @OnEvent('permission.updated')
  handlePermissionUpdated(event: PermissionUpdatedEvent): void {
    this.logger.log(`Permission updated: ${event.name} (${event.id})`);
  }

  @OnEvent('permission.deleted')
  handlePermissionDeleted(event: PermissionDeletedEvent): void {
    this.logger.log(`Permission deleted: ${event.name} (${event.id})`);
  }

  @OnEvent('permission-group.created')
  handlePermissionGroupCreated(event: PermissionGroupCreatedEvent): void {
    this.logger.log(`Permission group created: ${event.name} (${event.id})`);
  }

  @OnEvent('permission-group.updated')
  handlePermissionGroupUpdated(event: PermissionGroupUpdatedEvent): void {
    this.logger.log(`Permission group ${event.action}: ${event.name} (${event.groupId})`);
  }

  @OnEvent('permission-group.deleted')
  handlePermissionGroupDeleted(event: PermissionGroupDeletedEvent): void {
    this.logger.log(`Permission group deleted: ${event.name} (${event.id})`);
  }

  @OnEvent('user-permissions.updated')
  handleUserPermissionsUpdated(event: UserPermissionsUpdatedEvent): void {
    this.logger.log(`User permissions updated for ${event.userId}: ${event.action} -> ${event.targetId}`);
  }
}
