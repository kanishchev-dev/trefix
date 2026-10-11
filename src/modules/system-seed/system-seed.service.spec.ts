import { ConfigService } from '@nestjs/config';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';

import appConfig from '@/config/app.config';
import {
  SYSTEM_PERMISSION_CATALOG,
  SYSTEM_PERMISSION_GROUPS,
} from '@/modules/permissions/constants/system-access.constants';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionGroup } from '@/modules/permissions/entities/permission-group.entity';
import { UserPermissionGroup } from '@/modules/permissions/entities/user-permission-group.entity';
import { User } from '@/modules/users/entities/user.entity';

import { SystemSeedService } from './system-seed.service';

describe('SystemSeedService', () => {
  const sequelize = {
    transaction: jest.fn(async (callback: (transaction: unknown) => Promise<void>) => callback({})),
    query: jest.fn().mockResolvedValue({ exists: true }),
  };

  const permissionModel = {};
  const permissionGroupModel = {};
  const userModel = {};
  const userPermissionGroupModel = {};
  const configService = {
    getOrThrow: jest.fn(),
  };

  async function createModule(autoSeedSystemData: boolean): Promise<SystemSeedService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SystemSeedService,
        {
          provide: appConfig.KEY,
          useValue: {
            autoSeedSystemData,
          },
        },
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: getConnectionToken(),
          useValue: sequelize,
        },
        {
          provide: getModelToken(Permission),
          useValue: permissionModel,
        },
        {
          provide: getModelToken(PermissionGroup),
          useValue: permissionGroupModel,
        },
        {
          provide: getModelToken(User),
          useValue: userModel,
        },
        {
          provide: getModelToken(UserPermissionGroup),
          useValue: userPermissionGroupModel,
        },
      ],
    }).compile();

    return module.get<SystemSeedService>(SystemSeedService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    (sequelize.query as jest.Mock).mockResolvedValue({ exists: true });
  });

  it('skips automatic seeding when disabled', async () => {
    const service = await createModule(false);
    const seedSpy = jest.spyOn(service, 'seedSystemData').mockResolvedValue();

    await service.onApplicationBootstrap();

    expect(seedSpy).not.toHaveBeenCalled();
    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  it('runs automatic seeding when enabled', async () => {
    const service = await createModule(true);
    const seedSpy = jest.spyOn(service, 'seedSystemData').mockResolvedValue();

    await service.onApplicationBootstrap();

    expect(seedSpy).toHaveBeenCalledTimes(1);
  });

  it('skips automatic seeding when the schema is not ready yet', async () => {
    const service = await createModule(true);
    jest.spyOn(service, 'seedSystemData').mockResolvedValue();
    (sequelize.query as jest.Mock).mockResolvedValueOnce({ exists: false });

    await service.onApplicationBootstrap();

    expect(sequelize.transaction).not.toHaveBeenCalled();
  });

  describe('seedSystemData', () => {
    const permissionNames = SYSTEM_PERMISSION_CATALOG.map((permission) => permission.key);
    const groupKeys = SYSTEM_PERMISSION_GROUPS.map((group) => group.systemKey);

    /**
     * Simulates a database where bootstrap already ran AND an admin has since
     * customised the system groups through the admin panel.
     */
    function stubBootstrappedDatabase(): void {
      (permissionModel as { findAll: jest.Mock }).findAll = jest
        .fn()
        .mockResolvedValue(permissionNames.map((name) => ({ name })));
      (permissionGroupModel as { findAll: jest.Mock }).findAll = jest
        .fn()
        .mockResolvedValue(groupKeys.map((systemKey, index) => ({ id: `group-${index}`, systemKey })));
      (userModel as { findOne: jest.Mock }).findOne = jest.fn().mockResolvedValue({ id: 'admin-1' });
      (userPermissionGroupModel as { findOne: jest.Mock }).findOne = jest
        .fn()
        .mockResolvedValue({ id: 'assignment-1' });
    }

    it('does not touch existing entities after the initial bootstrap', async () => {
      const service = await createModule(true);
      stubBootstrappedDatabase();

      await service.seedSystemData();

      expect(permissionModel).not.toHaveProperty('update');
      expect(permissionGroupModel).not.toHaveProperty('update');
      expect(userModel).not.toHaveProperty('create');
    });

    it('runs when the initial admin is missing', async () => {
      const service = await createModule(true);
      stubBootstrappedDatabase();
      (userModel as { findOne: jest.Mock }).findOne.mockResolvedValue(null);
      (permissionModel as { findOne: jest.Mock }).findOne = jest.fn().mockResolvedValue(null);
      (permissionModel as { create: jest.Mock }).create = jest
        .fn()
        .mockImplementation(async ({ name }: { name: string }) => ({ id: `p-${name}`, name }));
      (permissionGroupModel as { findOne: jest.Mock }).findOne = jest.fn().mockResolvedValue(null);
      (permissionGroupModel as { create: jest.Mock }).create = jest
        .fn()
        .mockImplementation(async ({ systemKey }: { systemKey: string }) => ({
          id: `group-${systemKey}`,
          systemKey,
          $add: jest.fn(),
        }));
      (userModel as { create: jest.Mock }).create = jest
        .fn()
        .mockImplementation(async (values: { email: string }) => ({ id: 'admin-1', ...values }));
      configService.getOrThrow.mockImplementation((key: string) =>
        key === 'ADMIN_EMAIL' ? 'admin@example.com' : 'secret-password',
      );

      await service.seedSystemData();

      expect((userModel as { create: jest.Mock }).create).toHaveBeenCalled();
      expect(configService.getOrThrow).toHaveBeenCalledWith('ADMIN_PASSWORD');
    });
  });
});
