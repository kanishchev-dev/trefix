import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';

import { Permission } from './entities/permission.entity';
import { PermissionGroup } from './entities/permission-group.entity';
import { PermissionsService } from './permissions.service';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let eventEmitter: EventEmitter2;

  const mockPermissionModel = {
    create: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
  };

  const mockPermissionGroupModel = {
    create: jest.fn(),
    findAndCountAll: jest.fn(),
    findByPk: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: getModelToken(Permission),
          useValue: mockPermissionModel,
        },
        {
          provide: getModelToken(PermissionGroup),
          useValue: mockPermissionGroupModel,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPermission', () => {
    it('should create a permission and emit an event', async () => {
      const dto = { name: 'test.perm', description: 'desc' };
      const mockResult = { id: 'uuid', ...dto };
      mockPermissionModel.create.mockResolvedValue(mockResult);

      const result = await service.createPermission(dto);

      expect(result).toEqual(mockResult);
      expect(eventEmitter.emit).toHaveBeenCalledWith('permission.created', expect.any(Object));
    });
  });

  describe('findAllPermissions', () => {
    it('should return a paginated list of permissions', async () => {
      const permission = { id: 'perm-1', name: 'users.read' };
      mockPermissionModel.findAndCountAll.mockResolvedValue({ rows: [permission], count: 1 });

      const result = await service.findAllPermissions();

      expect(result.data).toEqual([permission]);
      expect(result.meta.total).toBe(1);
      expect(mockPermissionModel.findAndCountAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        order: [['name', 'ASC']],
      });
    });
  });

  describe('findAllGroups', () => {
    it('should return a paginated list of permission groups', async () => {
      const group = { id: 'group-1', name: 'Administrators' };
      mockPermissionGroupModel.findAndCountAll.mockResolvedValue({ rows: [group], count: 1 });

      const result = await service.findAllGroups();

      expect(result.data).toEqual([group]);
      expect(result.meta.total).toBe(1);
      expect(mockPermissionGroupModel.findAndCountAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
        order: [['name', 'ASC']],
      });
    });
  });

  describe('findPermissionCatalog', () => {
    it('should return every permission without pagination, ordered by name', async () => {
      const permissions = [
        { id: 'perm-2', name: 'users.read' },
        { id: 'perm-1', name: 'permissions.read' },
      ];
      mockPermissionModel.findAll.mockResolvedValue(permissions);

      const result = await service.findPermissionCatalog();

      expect(result).toEqual(permissions);
      expect(mockPermissionModel.findAll).toHaveBeenCalledWith({
        order: [['name', 'ASC']],
      });
      expect(mockPermissionModel.findAndCountAll).not.toHaveBeenCalled();
    });
  });

  describe('updatePermission', () => {
    it('should emit an update event after updating a permission', async () => {
      const permission = {
        id: 'perm-1',
        name: 'users.read',
        update: jest.fn().mockResolvedValue({ id: 'perm-1', name: 'users.write' }),
      };
      mockPermissionModel.findByPk.mockResolvedValue(permission);

      await service.updatePermission('perm-1', { name: 'users.write' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'permission.updated',
        expect.objectContaining({ id: 'perm-1', name: 'users.write' }),
      );
    });
  });

  describe('updateGroup', () => {
    it('should emit an update event after updating a permission group', async () => {
      const group = {
        id: 'group-1',
        name: 'Managers',
        update: jest.fn().mockResolvedValue({ id: 'group-1', name: 'Leads' }),
      };
      mockPermissionGroupModel.findByPk.mockResolvedValue(group);

      await service.updateGroup('group-1', { name: 'Leads' });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'permission-group.updated',
        expect.objectContaining({ groupId: 'group-1', name: 'Leads', action: 'updated' }),
      );
    });
  });

  describe('removeGroup', () => {
    it('should forbid deleting a system permission group', async () => {
      const group = {
        id: 'group-1',
        name: 'Administrators',
        isSystem: true,
        destroy: jest.fn(),
      };
      jest.spyOn(service, 'findGroup').mockResolvedValue(group as unknown as PermissionGroup);

      await expect(service.removeGroup('group-1')).rejects.toThrow('System permission group cannot be deleted');
      expect(group.destroy).not.toHaveBeenCalled();
    });
  });
});
