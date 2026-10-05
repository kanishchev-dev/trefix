import { Test, TestingModule } from '@nestjs/testing';

import { RealtimePresenceService } from '@/modules/realtime/services/realtime-presence.service';

import { AdminUsersService } from './services/admin-users.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;
  let adminService: AdminUsersService;
  let presenceService: { onlineAmong: jest.Mock };

  const mockUser = {
    id: 'uuid-v4',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            create: jest.fn().mockResolvedValue(mockUser),
            adminUpdate: jest.fn().mockResolvedValue(mockUser),
            findAdminDetail: jest.fn().mockResolvedValue(mockUser),
            findAll: jest.fn().mockResolvedValue({
              data: [mockUser],
              meta: {
                total: 1,
                page: 1,
                limit: 10,
                totalPages: 1,
                hasNextPage: false,
                hasPreviousPage: false,
              },
            }),
            findOne: jest.fn().mockResolvedValue(mockUser),
            remove: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AdminUsersService,
          useValue: {
            createFromAdmin: jest.fn().mockResolvedValue(mockUser),
            updateFromAdmin: jest.fn().mockResolvedValue(mockUser),
            getAdminDetail: jest.fn().mockResolvedValue(mockUser),
            inviteFromAdmin: jest.fn().mockResolvedValue(undefined),
            deleteFromAdmin: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: RealtimePresenceService,
          useValue: {
            onlineAmong: jest.fn().mockResolvedValue(new Set<string>()),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
    adminService = module.get<AdminUsersService>(AdminUsersService);
    presenceService = module.get(RealtimePresenceService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated users', async () => {
      const result = await controller.findAll();
      expect(result.data).toEqual([mockUser]);
      expect(service.findAll).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return the aggregated admin detail', async () => {
      await controller.findOne(mockUser.id);
      expect(adminService.getAdminDetail).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('update', () => {
    it('should update the user and return the aggregated detail', async () => {
      await controller.update(mockUser.id, { firstName: 'Jane' });
      expect(adminService.updateFromAdmin).toHaveBeenCalledWith(mockUser.id, {
        firstName: 'Jane',
      });
      expect(adminService.getAdminDetail).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('createInvitation', () => {
    it('should delegate invite sending to the admin service', async () => {
      await controller.createInvitation(mockUser.id);
      expect(adminService.inviteFromAdmin).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('remove', () => {
    it('should remove a user', async () => {
      await controller.remove(mockUser.id);
      expect(adminService.deleteFromAdmin).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('create', () => {
    it('should delegate creation to the admin service', async () => {
      const dto = { email: 'test@example.com', firstName: 'John', lastName: 'Doe' };
      const result = await controller.create(dto);

      expect(result).toEqual(mockUser);
      expect(adminService.createFromAdmin).toHaveBeenCalledWith(dto);
    });
  });

  describe('getPresence', () => {
    it('reports only the online subset of the requested users', async () => {
      const ids = ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'];
      presenceService.onlineAmong.mockResolvedValueOnce(new Set([ids[0]]));

      await expect(controller.getPresence({ ids })).resolves.toEqual({ onlineUserIds: [ids[0]] });
    });

    it('asks about nobody when no ids were given', async () => {
      await expect(controller.getPresence({})).resolves.toEqual({ onlineUserIds: [] });
      expect(presenceService.onlineAmong).toHaveBeenCalledWith([]);
    });
  });
});
