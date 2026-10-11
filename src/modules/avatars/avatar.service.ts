import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService, ConfigType } from '@nestjs/config';
import { Readable } from 'stream';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import appConfig from '@/config/app.config';
import { StorageUploadedFile } from '@/modules/storage/interfaces/storage-uploaded-file.interface';
import { StorageService } from '@/modules/storage/storage.service';
import { UsersService } from '@/modules/users/users.service';

import {
  AVATAR_ALLOWED_MIME_TYPES,
  AVATAR_MAX_SIZE_BYTES,
  AVATAR_SCOPE_TYPE,
  AVATAR_STORAGE_FOLDER,
  AVATAR_VERSION_PARAM,
} from './constants/avatar.constants';
import { AvatarInvalidFileException } from './exceptions/avatar-invalid-file.exception';
import { AvatarTooLargeException } from './exceptions/avatar-too-large.exception';

/** URI versioning prefix used by the whole API, see `main.ts`. */
const API_VERSION_PREFIX = 'v1';

export type AvatarSource =
  | {
      kind: 'file';
      stream: Readable;
      mimeType: string;
      size?: number | null;
      etag?: string;
      lastModified?: Date;
    }
  | { kind: 'redirect'; url: string };

/**
 * Avatars are stored as ordinary storage files and referenced from
 * `users.avatar_url` by an absolute URL of this API.
 *
 * Storing the URL rather than a file id keeps every consumer working without
 * changes: the admin panel, the mobile app and activation emails all read
 * `avatarUrl` and expect a URL. The `?v=<fileId>` suffix is what makes the
 * link change on every replacement, so caches can treat it as immutable.
 */
@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  constructor(
    @Inject(appConfig.KEY)
    private readonly appConfiguration: ConfigType<typeof appConfig>,
    private readonly configService: ConfigService,
    private readonly storageService: StorageService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Stores a new avatar for the user and points `avatarUrl` at it.
   *
   * The previous avatar is deleted only when this service owns it: an avatar
   * set from an external URL is left untouched, because the file lives
   * somewhere else entirely.
   */
  async uploadAvatar(userId: string, file: StorageUploadedFile | undefined): Promise<string> {
    this.validateFile(file);

    const user = await this.usersService.findOne(userId);
    const previousAvatarUrl = user.avatarUrl;
    const previousFileId = this.extractManagedFileId(previousAvatarUrl);

    const storedFile = await this.storageService.uploadFile(file, {
      uploaderUserId: userId,
      scopeType: AVATAR_SCOPE_TYPE,
      scopeId: userId,
      folder: AVATAR_STORAGE_FOLDER,
    });

    const avatarUrl = this.buildAvatarUrl(userId, storedFile.id);
    await this.usersService.update(userId, { avatarUrl });

    if (previousFileId && previousFileId !== storedFile.id) {
      await this.storageService.deleteFileQuietly(previousFileId);
    }

    this.logger.log(`Avatar replaced for user ${userId} (file ${storedFile.id})`);

    return avatarUrl;
  }

  /**
   * Resolves what to answer for `GET /avatars/:userId`.
   *
   * An avatar that points at an external URL is redirected instead of being
   * proxied, so third-party hosting is not turned into an open relay.
   */
  async resolveAvatarSource(userId: string): Promise<AvatarSource> {
    const user = await this.usersService.findOne(userId);
    const avatarUrl = user.avatarUrl;

    if (!avatarUrl) {
      throw new EntityNotFoundException('Avatar', userId);
    }

    const fileId = this.extractManagedFileId(avatarUrl);

    if (!fileId) {
      return { kind: 'redirect', url: avatarUrl };
    }

    const { file, stream, download } = await this.storageService.getFileForPublicAccess(fileId);

    return {
      kind: 'file',
      stream,
      mimeType: file.mimeType,
      size: download.contentLength ?? file.size,
      etag: download.etag,
      lastModified: download.lastModified,
    };
  }

  /** Absolute, cache-busted URL of the avatar for the given user. */
  buildAvatarUrl(userId: string, fileId: string): string {
    const baseUrl = this.resolveApiBaseUrl();
    return `${baseUrl}/${API_VERSION_PREFIX}/avatars/${userId}?${AVATAR_VERSION_PARAM}=${fileId}`;
  }

  /** True when the URL was produced by {@link buildAvatarUrl}. */
  isManagedAvatarUrl(avatarUrl?: string | null): boolean {
    return Boolean(avatarUrl && this.extractManagedFileId(avatarUrl));
  }

  /**
   * File id encoded in a managed avatar URL, or `null` for external URLs.
   */
  extractManagedFileId(avatarUrl?: string | null): string | null {
    if (!avatarUrl) {
      return null;
    }

    const prefix = `${this.resolveApiBaseUrl()}/${API_VERSION_PREFIX}/avatars/`;

    if (!avatarUrl.startsWith(prefix)) {
      return null;
    }

    const version = new URL(avatarUrl).searchParams.get(AVATAR_VERSION_PARAM);
    return version && version.length > 0 ? version : null;
  }

  private resolveApiBaseUrl(): string {
    const configured = this.configService.get<string>('app.apiBaseUrl') ?? this.appConfiguration.apiBaseUrl;

    return configured.replace(/\/+$/, '');
  }

  private validateFile(file: StorageUploadedFile | undefined): asserts file is StorageUploadedFile {
    // `FileInterceptor` leaves the field undefined when the request carried no
    // file part at all, which has to be a client error rather than a crash.
    if (!file) {
      throw new AvatarInvalidFileException();
    }

    const isAllowed = (AVATAR_ALLOWED_MIME_TYPES as readonly string[]).includes(file.mimetype);

    if (!isAllowed) {
      throw new AvatarInvalidFileException(file.mimetype);
    }

    if (file.size > AVATAR_MAX_SIZE_BYTES) {
      throw new AvatarTooLargeException();
    }
  }
}
