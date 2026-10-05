import { ConfigService } from '@nestjs/config';
import { Readable } from 'stream';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { StorageUploadedFile } from '@/modules/storage/interfaces/storage-uploaded-file.interface';
import { StorageService } from '@/modules/storage/storage.service';
import { UsersService } from '@/modules/users/users.service';

import { AvatarService } from './avatar.service';
import { AvatarInvalidFileException } from './exceptions/avatar-invalid-file.exception';
import { AvatarTooLargeException } from './exceptions/avatar-too-large.exception';

const API_BASE_URL = 'https://api.example.com';
const USER_ID = '11111111-1111-4111-8111-111111111111';

function buildService(overrides: {
  avatarUrl?: string | null;
  storageFileId?: string;
} = {}): {
  service: AvatarService;
  storageService: jest.Mocked<
    Pick<
      StorageService,
      'uploadFile' | 'deleteFileQuietly' | 'getFileForPublicAccess'
    >
  >;
  usersService: jest.Mocked<Pick<UsersService, 'findOne' | 'update'>>;
} {
  const user = {
    id: USER_ID,
    avatarUrl: overrides.avatarUrl ?? null,
  } as Awaited<ReturnType<UsersService['findOne']>>;

  const storageService = {
    uploadFile: jest.fn().mockResolvedValue({
      id: overrides.storageFileId ?? 'file-new',
      mimeType: 'image/webp',
      size: 2048,
    }),
    deleteFileQuietly: jest.fn().mockResolvedValue(undefined),
    getFileForPublicAccess: jest.fn().mockResolvedValue({
      file: { mimeType: 'image/webp', size: 2048 },
      stream: Readable.from([Buffer.from('image')]),
      download: { stream: Readable.from([Buffer.from('image')]), contentLength: 2048 },
    }),
  } as unknown as jest.Mocked<
    Pick<StorageService, 'uploadFile' | 'deleteFileQuietly' | 'getFileForPublicAccess'>
  >;

  const usersService = {
    findOne: jest.fn().mockResolvedValue(user),
    update: jest.fn().mockImplementation(async (id: string, dto: { avatarUrl?: string }) => {
      user.avatarUrl = dto.avatarUrl ?? null;
      return user;
    }),
  } as unknown as jest.Mocked<Pick<UsersService, 'findOne' | 'update'>>;

  const configService = {
    get: jest.fn((key: string) =>
      key === 'app.apiBaseUrl' ? API_BASE_URL : undefined,
    ),
  } as unknown as ConfigService;

  const appConfiguration = {
    env: 'test',
    port: 3000,
    logLevel: 'info',
    autoSeedSystemData: false,
    corsOrigins: [],
    webAppUrl: 'https://app.example.com',
    apiBaseUrl: API_BASE_URL,
  };

  const service = new AvatarService(
    appConfiguration as never,
    configService,
    storageService as unknown as StorageService,
    usersService as unknown as UsersService,
  );

  return { service, storageService, usersService };
}

function buildFile(overrides: Partial<StorageUploadedFile> = {}): StorageUploadedFile {
  return {
    originalname: 'avatar.webp',
    mimetype: 'image/webp',
    size: 2048,
    buffer: Buffer.from('image'),
    ...overrides,
  };
}

describe('AvatarService', () => {
  describe('buildAvatarUrl', () => {
    it('builds an absolute, versioned URL on the API', () => {
      const { service } = buildService();

      expect(service.buildAvatarUrl(USER_ID, 'file-1')).toBe(
        `${API_BASE_URL}/v1/avatars/${USER_ID}?v=file-1`,
      );
    });
  });

  describe('extractManagedFileId', () => {
    it('reads the file id out of a managed URL', () => {
      const { service } = buildService();

      expect(
        service.extractManagedFileId(`${API_BASE_URL}/v1/avatars/${USER_ID}?v=file-1`),
      ).toBe('file-1');
    });

    it('ignores external URLs', () => {
      const { service } = buildService();

      expect(service.extractManagedFileId('https://cdn.example.com/me.png')).toBeNull();
      expect(service.extractManagedFileId(null)).toBeNull();
    });

    it('ignores a managed path without a version parameter', () => {
      const { service } = buildService();

      expect(service.extractManagedFileId(`${API_BASE_URL}/v1/avatars/${USER_ID}`)).toBeNull();
    });
  });

  describe('uploadAvatar', () => {
    it('stores the file in the user scope and points avatarUrl at it', async () => {
      const { service, storageService, usersService } = buildService();

      const avatarUrl = await service.uploadAvatar(USER_ID, buildFile());

      expect(storageService.uploadFile).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          uploaderUserId: USER_ID,
          scopeType: 'users',
          scopeId: USER_ID,
          folder: 'avatars',
        }),
      );
      expect(usersService.update).toHaveBeenCalledWith(USER_ID, { avatarUrl });
      expect(avatarUrl).toContain(`/v1/avatars/${USER_ID}?v=file-new`);
    });

    it('deletes the previous managed file', async () => {
      const { service, storageService } = buildService({
        avatarUrl: `${API_BASE_URL}/v1/avatars/${USER_ID}?v=file-old`,
      });

      await service.uploadAvatar(USER_ID, buildFile());

      expect(storageService.deleteFileQuietly).toHaveBeenCalledWith('file-old');
    });

    it('keeps an externally hosted avatar file untouched', async () => {
      const { service, storageService } = buildService({
        avatarUrl: 'https://cdn.example.com/me.png',
      });

      await service.uploadAvatar(USER_ID, buildFile());

      expect(storageService.deleteFileQuietly).not.toHaveBeenCalled();
    });

    it('rejects a request without a file at all', async () => {
      const { service, storageService } = buildService();

      await expect(service.uploadAvatar(USER_ID, undefined)).rejects.toBeInstanceOf(
        AvatarInvalidFileException,
      );
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });

    it('rejects a non-image upload before touching storage', async () => {
      const { service, storageService } = buildService();

      await expect(
        service.uploadAvatar(USER_ID, buildFile({ mimetype: 'image/svg+xml' })),
      ).rejects.toBeInstanceOf(AvatarInvalidFileException);
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });

    it('rejects an oversized upload', async () => {
      const { service, storageService } = buildService();

      await expect(
        service.uploadAvatar(USER_ID, buildFile({ size: 3 * 1024 * 1024 })),
      ).rejects.toBeInstanceOf(AvatarTooLargeException);
      expect(storageService.uploadFile).not.toHaveBeenCalled();
    });
  });

  describe('resolveAvatarSource', () => {
    it('streams a managed avatar with its metadata', async () => {
      const { service } = buildService({
        avatarUrl: `${API_BASE_URL}/v1/avatars/${USER_ID}?v=file-1`,
      });

      const source = await service.resolveAvatarSource(USER_ID);

      expect(source.kind).toBe('file');
      if (source.kind !== 'file') {
        throw new Error('unreachable');
      }
      expect(source.mimeType).toBe('image/webp');
      expect(source.size).toBe(2048);
    });

    it('redirects instead of proxying an external avatar', async () => {
      const { service, storageService } = buildService({
        avatarUrl: 'https://cdn.example.com/me.png',
      });

      const source = await service.resolveAvatarSource(USER_ID);

      expect(source).toEqual({ kind: 'redirect', url: 'https://cdn.example.com/me.png' });
      expect(storageService.getFileForPublicAccess).not.toHaveBeenCalled();
    });

    it('reports a missing avatar as not found', async () => {
      const { service } = buildService({ avatarUrl: null });

      await expect(service.resolveAvatarSource(USER_ID)).rejects.toBeInstanceOf(
        EntityNotFoundException,
      );
    });
  });
});
