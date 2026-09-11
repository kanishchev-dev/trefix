import { VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { UsersController } from '@/modules/users/users.controller';
import { UsersService } from '@/modules/users/users.service';

describe('UsersController (e2e)', () => {
  let controller: UsersController;

  const userData = {
    id: 'b8c8d8e8-f8a8-48b8-88c8-d8e8f8a8b8c8',
    email: 'e2e@example.com',
    firstName: 'E2E',
    lastName: 'Test',
  };

  const mockUsersService = {
    create: jest.fn().mockResolvedValue(userData),
    findAll: jest.fn().mockResolvedValue(new PaginatedResponseDto([userData], 1, 1, 10)),
    findOne: jest.fn().mockResolvedValue(userData),
    remove: jest.fn().mockResolvedValue(undefined),
  } as unknown as jest.Mocked<UsersService>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = moduleFixture.get(UsersController);
    expect(VersioningType.URI).toBeDefined();
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  it('creates a user', async () => {
    await expect(
      controller.create({
        email: 'e2e@example.com',
        firstName: 'E2E',
        lastName: 'Test',
      }),
    ).resolves.toEqual(userData);
  });

  it('returns a paginated user list', async () => {
    await expect(controller.findAll()).resolves.toEqual(new PaginatedResponseDto([userData], 1, 1, 10));
  });

  it('deletes a user', async () => {
    await expect(controller.remove(userData.id)).resolves.toBeUndefined();
  });
});
