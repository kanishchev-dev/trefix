import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { createReadStream, promises as fs } from 'fs';
import { basename } from 'path';
import { Readable } from 'stream';

import { DomainException } from '@/common/exceptions/domain.exception';

import { StorageFile } from './entities/storage-file.entity';
import { StorageFileDeletedEvent } from './events/storage-file-deleted.event';
import { StorageFileUploadedEvent } from './events/storage-file-uploaded.event';
import { StorageFileForbiddenException } from './exceptions/storage-file-forbidden.exception';
import { StorageFileNotFoundException } from './exceptions/storage-file-not-found.exception';
import { StorageFileOperationException } from './exceptions/storage-file-operation.exception';
import { StorageFileTooLargeException } from './exceptions/storage-file-too-large.exception';
import { StorageInvalidUploadPayloadException } from './exceptions/storage-invalid-upload-payload.exception';
import { StorageAccessContext, StorageUploadContext } from './interfaces/storage-access-context.interface';
import { StorageAdapter } from './interfaces/storage-adapter.interface';
import { StorageUploadedFile } from './interfaces/storage-uploaded-file.interface';
import { STORAGE_ADAPTER, STORAGE_EVENT_FILE_DELETED, STORAGE_EVENT_FILE_UPLOADED } from './storage.constants';
import { buildStorageKey } from './utils/storage-path.util';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);

  constructor(
    @InjectModel(StorageFile)
    private readonly storageFileModel: typeof StorageFile,
    @Inject(STORAGE_ADAPTER)
    private readonly adapter: StorageAdapter,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  async uploadFile(file: StorageUploadedFile, context: StorageUploadContext = {}): Promise<StorageFile> {
    this.validateUploadFile(file);

    const maxFileSize = this.configService.get<number>('storage.maxFileSize');
    if (typeof maxFileSize === 'number' && file.size > maxFileSize) {
      throw new StorageFileTooLargeException(maxFileSize);
    }

    const storageKey = buildStorageKey({
      originalName: file.originalname,
      scopeType: context.scopeType,
      scopeId: context.scopeId,
      folder: context.folder,
    });

    const body = this.createUploadStream(file);
    let uploadedToStorage = false;

    try {
      await this.adapter.upload({
        key: storageKey,
        body,
        contentType: file.mimetype,
        contentLength: file.size,
      });
      uploadedToStorage = true;

      const createdFile = await this.storageFileModel.create({
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        storageKey,
        uploaderUserId: context.uploaderUserId ?? null,
        scopeType: context.scopeType ?? null,
        scopeId: context.scopeId ?? null,
        folder: context.folder ?? null,
      });

      this.eventEmitter.emit(
        STORAGE_EVENT_FILE_UPLOADED,
        new StorageFileUploadedEvent(
          createdFile.id,
          createdFile.storageKey,
          createdFile.uploaderUserId ?? null,
          createdFile.originalName,
          createdFile.mimeType,
          createdFile.size,
          createdFile.scopeType ?? null,
          createdFile.scopeId ?? null,
        ),
      );

      return createdFile;
    } catch (error) {
      if (uploadedToStorage) {
        try {
          await this.adapter.delete(storageKey);
        } catch (deleteError) {
          this.logger.warn(`Failed to clean up storage object ${storageKey}: ${String(deleteError)}`);
        }
      }

      if (error instanceof DomainException) {
        throw error;
      }

      throw new StorageFileOperationException('Failed to upload storage file');
    } finally {
      await this.safeDeleteTempFile(file);
    }
  }

  async findById(id: string): Promise<StorageFile> {
    const file = await this.storageFileModel.findByPk(id);
    if (!file) {
      throw new StorageFileNotFoundException(id);
    }
    return file;
  }

  async getMetadata(id: string): Promise<StorageFile> {
    return this.findById(id);
  }

  async exists(id: string): Promise<boolean> {
    try {
      const file = await this.findById(id);
      return await this.adapter.exists(file.storageKey);
    } catch {
      return false;
    }
  }

  async getFile(id: string, context: StorageAccessContext = {}): Promise<{ file: StorageFile; stream: Readable }> {
    const file = await this.findById(id);
    this.assertCanAccess(file, context.requesterUserId);

    let fileExists = false;

    try {
      fileExists = await this.adapter.exists(file.storageKey);
    } catch {
      throw new StorageFileOperationException('Failed to verify storage file');
    }

    if (!fileExists) {
      throw new StorageFileNotFoundException(id);
    }

    try {
      const download = await this.adapter.download(file.storageKey);
      return {
        file,
        stream: download.stream,
      };
    } catch {
      throw new StorageFileOperationException('Failed to download storage file');
    }
  }

  async deleteFile(id: string, context: StorageAccessContext = {}): Promise<void> {
    const file = await this.findById(id);
    this.assertCanDelete(file, context.requesterUserId);

    try {
      await this.adapter.delete(file.storageKey);
    } catch {
      throw new StorageFileOperationException('Failed to delete storage file');
    }

    await file.destroy();

    this.eventEmitter.emit(
      STORAGE_EVENT_FILE_DELETED,
      new StorageFileDeletedEvent(
        file.id,
        file.storageKey,
        file.uploaderUserId ?? null,
        file.scopeType ?? null,
        file.scopeId ?? null,
      ),
    );
  }

  buildKey(input: {
    originalName: string;
    scopeType?: string | null;
    scopeId?: string | null;
    folder?: string | null;
  }): string {
    return buildStorageKey(input);
  }

  private createUploadStream(file: StorageUploadedFile): Readable {
    if (file.path) {
      return createReadStream(file.path);
    }

    if (file.buffer) {
      return Readable.from([file.buffer]);
    }

    throw new StorageInvalidUploadPayloadException();
  }

  private validateUploadFile(file: StorageUploadedFile): void {
    if (!file || !file.originalname || !file.mimetype) {
      throw new StorageInvalidUploadPayloadException();
    }
  }

  private assertCanAccess(file: StorageFile, requesterUserId?: string): void {
    if (!requesterUserId) {
      return;
    }

    if (file.uploaderUserId && file.uploaderUserId !== requesterUserId) {
      throw new StorageFileForbiddenException(file.id);
    }
  }

  private assertCanDelete(file: StorageFile, requesterUserId?: string): void {
    if (!requesterUserId) {
      return;
    }

    if (file.uploaderUserId && file.uploaderUserId !== requesterUserId) {
      throw new StorageFileForbiddenException(file.id);
    }
  }

  private async safeDeleteTempFile(file: StorageUploadedFile): Promise<void> {
    if (!file.path) {
      return;
    }

    try {
      await fs.unlink(file.path);
    } catch {
      this.logger.debug(`Unable to remove temporary file: ${basename(file.path)}`);
    }
  }
}
