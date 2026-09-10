import { RealtimeService } from '@/modules/realtime/realtime.service';

import { PermissionCreatedEvent } from '../events/permission-created.event';
import { UserPermissionsUpdatedEvent } from '../events/user-permissions-updated.event';
import { PermissionsListener } from './permissions.listener';

describe('PermissionsListener', () => {
  const realtimeService = {
    emitToRoom: jest.fn(),
    emitToUser: jest.fn(),
  } as unknown as RealtimeService;

  let listener: PermissionsListener;

  beforeEach(() => {
    jest.clearAllMocks();
    listener = new PermissionsListener(realtimeService);
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
