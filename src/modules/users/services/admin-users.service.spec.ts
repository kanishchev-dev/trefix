import { Test, TestingModule } from '@nestjs/testing';

import { AdminCreateUserDto } from '../dto/admin-create-user.dto';
import { User } from '../entities/user.entity';
import { UsersService } from '../users.service';
import { AdminUsersService } from './admin-users.service';
import { UserInviteService } from './user-invite.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let usersService: { create: jest.Mock };

  beforeEach(async () => {
    usersService = {
      create: jest.fn().mockImplementation((dto) => Promise.resolve({ id: 'user-1', ...dto } as User)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: UsersService, useValue: usersService },
        {
          provide: UserInviteService,
          useValue: { inviteUser: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createFromAdmin', () => {
    it('should create a passwordless user in the unverified invite state', async () => {
      const dto: AdminCreateUserDto = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      await service.createFromAdmin(dto);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: null,
          emailVerified: false,
        }),
      );
    });

    it('should hash the password and mark the user verified', async () => {
      const dto: AdminCreateUserDto = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Str0ngP@ss!',
      };

      await service.createFromAdmin(dto);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          passwordHash: expect.stringMatching(/^pbkdf2\$/),
          emailVerified: true,
        }),
      );
    });

    it('should keep the explicit verification flag over the password default', async () => {
      const dto: AdminCreateUserDto = {
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'Str0ngP@ss!',
        emailVerified: false,
      };

      await service.createFromAdmin(dto);

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          emailVerified: false,
        }),
      );
    });
  });
});
