import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';

import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let model: typeof User;
  let eventEmitter: EventEmitter2;

  const mockUser = {
    id: 'uuid-v4',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getModelToken(User),
          useValue: {
            create: jest.fn().mockResolvedValue(mockUser),
            findOne: jest.fn().mockResolvedValue(null),
            findAndCountAll: jest.fn().mockResolvedValue({ rows: [mockUser], count: 1 }),
            findByPk: jest.fn().mockResolvedValue(mockUser),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    model = module.get<typeof User>(getModelToken(User));
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should create a user and emit an event', async () => {
      const dto = { email: 'test@example.com', firstName: 'John', lastName: 'Doe' };
      const result = await service.create(dto);

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          passwordHash: null,
          emailVerified: false,
          emailVerifiedAt: null,
          passwordChangedAt: null,
        }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.created', expect.anything());
      expect(result).toEqual(mockUser);
    });
  });

  describe('findAll', () => {
    it('should return a paginated list of users', async () => {
      const result = await service.findAll();
      expect(result.data).toEqual([mockUser]);
      expect(result.meta.total).toBe(1);
      expect(model.findAndCountAll).toHaveBeenCalledWith({
        limit: 10,
        offset: 0,
      });
    });
  });

  describe('remove', () => {
    it('should remove a user and emit an event', async () => {
      const user = { ...mockUser, destroy: jest.fn().mockResolvedValue(undefined) };
      jest.spyOn(service, 'findOne').mockResolvedValue(user as unknown as User);

      await service.remove(mockUser.id);

      expect(user.destroy).toHaveBeenCalled();
      expect(eventEmitter.emit).toHaveBeenCalledWith('user.deleted', expect.anything());
    });
  });
});
