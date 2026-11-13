import { PermissionCreatedEvent } from '@/modules/permissions/events/permission-created.event';
import { UserPermissionsUpdatedEvent } from '@/modules/permissions/events/user-permissions-updated.event';

import { RealtimeService } from '../realtime.service';
import { PermissionsRealtimeListener } from './permissions-realtime.listener';

describe('PermissionsRealtimeListener', () => {
  const realtimeService = {
    emitToRoom: jest.fn(),
    emitToUser: jest.fn(),
  } as unknown as RealtimeService;

  let listener: PermissionsRealtimeListener;

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new PermissionsRealtimeListener(realtimeService);
  });

  it('publishes permission updates to the permissions room', () => {
    const event = new PermissionCreatedEvent('perm-1', 'users.read');

    listener.handlePermissionCreated(event);

    expect(realtimeService.emitToRoom).toHaveBeenCalledWith('permissions', 'permission.created', event);
  });

  it('publishes user permission updates to the user room and permissions room', () => {
    const event = new UserPermissionsUpdatedEvent('user-1', 'assign_permission', 'perm-1');

    listener.handleUserPermissionsUpdated(event);

    expect(realtimeService.emitToUser).toHaveBeenCalledWith('user-1', 'user-permissions.updated', event);
    expect(realtimeService.emitToRoom).toHaveBeenCalledWith('permissions', 'user-permissions.updated', event);
  });
});
