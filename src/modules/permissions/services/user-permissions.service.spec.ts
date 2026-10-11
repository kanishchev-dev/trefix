import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cache } from 'cache-manager';
import { ForeignKeyConstraintError } from 'sequelize';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';

import { Permission } from '../entities/permission.entity';
import { PermissionGroup } from '../entities/permission-group.entity';
import { UserPermission } from '../entities/user-permission.entity';
import { UserPermissionGroup } from '../entities/user-permission-group.entity';
import { UserPermissionsService } from './user-permissions.service';

/** In-memory stand-in for the Redis cache store. */
function memoryCache(): Cache & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>();
  return {
    store,
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  } as unknown as Cache & { store: Map<string, unknown> };
}

describe('UserPermissionsService', () => {
  let permissionModel: { findAll: jest.Mock; findByPk: jest.Mock };
  let groupModel: { findAll: jest.Mock; findByPk: jest.Mock };
  let userPermissionModel: { findAll: jest.Mock; findOrCreate: jest.Mock; destroy: jest.Mock };
  let userGroupModel: { findAll: jest.Mock; findOrCreate: jest.Mock; destroy: jest.Mock };
  let cache: ReturnType<typeof memoryCache>;
  let events: { emit: jest.Mock };
  let service: UserPermissionsService;

  beforeEach(() => {
    permissionModel = {
      findAll: jest.fn().mockResolvedValue([{ name: 'perm.a' }, { name: 'perm.b' }]),
      findByPk: jest.fn().mockResolvedValue({ id: 'perm-1' }),
    };
    groupModel = {
      findAll: jest.fn().mockResolvedValue([
        { id: 'g-1', name: 'Group 1', permissions: [{ name: 'perm.b' }, { name: 'perm.c' }] },
        { id: 'g-2', name: 'Group 2', permissions: [{ name: 'perm.d' }] },
      ]),
      findByPk: jest.fn().mockResolvedValue({ id: 'g-1' }),
    };
    userPermissionModel = {
      findAll: jest.fn().mockResolvedValue([{ permissionId: 'perm-1' }, { permissionId: 'perm-2' }]),
      findOrCreate: jest.fn(),
      destroy: jest.fn(),
    };
    userGroupModel = {
      findAll: jest.fn().mockResolvedValue([{ permissionGroupId: 'g-1' }, { permissionGroupId: 'g-2' }]),
      findOrCreate: jest.fn(),
      destroy: jest.fn(),
    };
    cache = memoryCache();
    events = { emit: jest.fn() };
    service = new UserPermissionsService(
      permissionModel as unknown as typeof Permission,
      groupModel as unknown as typeof PermissionGroup,
      userPermissionModel as unknown as typeof UserPermission,
      userGroupModel as unknown as typeof UserPermissionGroup,
      cache,
      events as unknown as EventEmitter2,
    );
  });

  it('combines individual grants with group permissions, without duplicates', async () => {
    const result = await service.getEffectivePermissions('user-1');

    expect(result.sort()).toEqual(['perm.a', 'perm.b', 'perm.c', 'perm.d']);
  });

  it('serves repeated lookups from the cache', async () => {
    await service.getEffectivePermissions('user-1');
    await service.getEffectivePermissions('user-1');

    expect(userPermissionModel.findAll).toHaveBeenCalledTimes(1);
  });

  it('drops the cached set as soon as a grant is revoked', async () => {
    await service.getEffectivePermissions('user-1');
    await service.revokeGroupFromUser('user-1', 'g-1');
    await service.getEffectivePermissions('user-1');

    expect(userPermissionModel.findAll).toHaveBeenCalledTimes(2);
    expect(events.emit).toHaveBeenCalledWith('user-permissions.updated', expect.objectContaining({ userId: 'user-1' }));
  });

  it('invalidates every user after a catalog change', async () => {
    await service.getEffectivePermissions('user-1');
    await service.getEffectivePermissions('user-2');
    await service.invalidateAll();
    await service.getEffectivePermissions('user-1');
    await service.getEffectivePermissions('user-2');

    expect(userPermissionModel.findAll).toHaveBeenCalledTimes(4);
  });

  it('returns no permissions for a user without grants', async () => {
    userPermissionModel.findAll.mockResolvedValue([]);
    userGroupModel.findAll.mockResolvedValue([]);

    await expect(service.getEffectivePermissions('user-3')).resolves.toEqual([]);
    expect(permissionModel.findAll).not.toHaveBeenCalled();
  });

  it('reports an unknown user when a grant cannot reference it', async () => {
    userGroupModel.findOrCreate.mockRejectedValue(new ForeignKeyConstraintError({}));

    await expect(service.assignGroupToUser('missing', 'g-1')).rejects.toBeInstanceOf(EntityNotFoundException);
  });
});
