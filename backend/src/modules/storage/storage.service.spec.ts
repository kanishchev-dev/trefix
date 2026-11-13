import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';

import { StorageFile } from './entities/storage-file.entity';
import { STORAGE_ADAPTER } from './storage.constants';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  let service: StorageService;

  const mockFileModel = {
    create: jest.fn(),
    findByPk: jest.fn(),
  };

  const mockAdapter = {
    upload: jest.fn(),
    download: jest.fn(),
    delete: jest.fn(),
    exists: jest.fn(),
    head: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StorageService,
        {
          provide: getModelToken(StorageFile),
          useValue: mockFileModel,
        },
        {
          provide: STORAGE_ADAPTER,
          useValue: mockAdapter,
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'storage.maxFileSize') {
                return 1024 * 1024;
              }
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<StorageService>(StorageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildKey', () => {
    it('should create a scoped storage key', () => {
      const key = service.buildKey({
        originalName: 'avatar.jpg',
        scopeType: 'users',
        scopeId: 'user-1',
        folder: 'avatars',
      });

      expect(key).toContain('users');
      expect(key).toContain('user-1');
      expect(key).toContain('avatars');
      expect(key).toContain('.jpg');
    });
  });
});
