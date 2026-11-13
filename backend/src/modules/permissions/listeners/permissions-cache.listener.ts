import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { PERMISSIONS_EVENTS } from '../permissions.events';
import { UserPermissionsService } from '../services/user-permissions.service';

/**
 * Keeps cached effective permissions in step with the catalog: renaming or
 * deleting a permission, or changing a group, can change any user's set.
 */
@Injectable()
export class PermissionsCacheListener {
  constructor(private readonly userPermissions: UserPermissionsService) {}

  @OnEvent(PERMISSIONS_EVENTS.PERMISSION_UPDATED)
  @OnEvent(PERMISSIONS_EVENTS.PERMISSION_DELETED)
  @OnEvent(PERMISSIONS_EVENTS.GROUP_UPDATED)
  @OnEvent(PERMISSIONS_EVENTS.GROUP_DELETED)
  async handleCatalogChanged(): Promise<void> {
    await this.userPermissions.invalidateAll();
  }
}
