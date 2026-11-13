import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { StorageFileDeletedEvent } from '../events/storage-file-deleted.event';
import { StorageFileUploadedEvent } from '../events/storage-file-uploaded.event';
import { STORAGE_EVENT_FILE_DELETED, STORAGE_EVENT_FILE_UPLOADED } from '../storage.constants';

@Injectable()
export class StorageListener {
  private readonly logger = new Logger(StorageListener.name);

  @OnEvent(STORAGE_EVENT_FILE_UPLOADED)
  handleFileUploaded(event: StorageFileUploadedEvent): void {
    this.logger.log(`Storage file uploaded: ${event.fileId} (${event.storageKey})`);
  }

  @OnEvent(STORAGE_EVENT_FILE_DELETED)
  handleFileDeleted(event: StorageFileDeletedEvent): void {
    this.logger.log(`Storage file deleted: ${event.fileId} (${event.storageKey})`);
  }
}
