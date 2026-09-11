import { Test, TestingModule } from '@nestjs/testing';

import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { StorageUploadedFile } from './interfaces/storage-uploaded-file.interface';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';

describe('StorageController', () => {
  let controller: StorageController;
  let service: StorageService;

  const mockFile = {
    id: 'file-1',
    originalName: 'avatar.jpg',
    mimeType: 'image/jpeg',
    size: 1234,
    storageKey: 'users/user-1/avatars/file.jpg',
  };
  const mockUser: AuthUserContext = {
    id: 'user-1',
    email: 'user@example.com',
    emailVerified: true,
    sessionId: 'session-1',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [StorageController],
      providers: [
        {
          provide: StorageService,
          useValue: {
            uploadFile: jest.fn().mockResolvedValue(mockFile),
            getFile: jest.fn().mockResolvedValue({ file: mockFile, stream: {} }),
            deleteFile: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    controller = module.get<StorageController>(StorageController);
    service = module.get<StorageService>(StorageService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    it('should return storage file metadata', async () => {
      const result = await controller.upload(
        {
          originalname: 'avatar.jpg',
          mimetype: 'image/jpeg',
          size: 1234,
        } as StorageUploadedFile,
        {
          scopeType: 'users',
          scopeId: 'user-1',
          folder: 'avatars',
        },
        mockUser,
      );

      expect(result).toEqual({
        id: 'file-1',
        name: 'avatar.jpg',
        mimeType: 'image/jpeg',
        size: 1234,
      });
      expect(service.uploadFile).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete a file', async () => {
      await controller.delete('file-1', mockUser);

      expect(service.deleteFile).toHaveBeenCalledWith('file-1', {
        requesterUserId: 'user-1',
      });
    });
  });
});
