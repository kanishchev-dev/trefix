import { ConfigService } from '@nestjs/config';
import { getConnectionToken, getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';

import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionGroup } from '@/modules/permissions/entities/permission-group.entity';
import { UserPermissionGroup } from '@/modules/permissions/entities/user-permission-group.entity';
import { User } from '@/modules/users/entities/user.entity';

import appConfig from '@/config/app.config';
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
});
