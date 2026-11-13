import { Readable } from 'stream';

export interface StorageUploadInput {
  key: string;
  body: Readable;
  contentType: string;
  contentLength?: number;
}

export interface StorageDownloadResult {
  stream: Readable;
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
}

export interface StorageObjectMetadata {
  contentType?: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
}

export interface StorageAdapter {
  upload(input: StorageUploadInput): Promise<StorageObjectMetadata>;
  download(key: string): Promise<StorageDownloadResult>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  head(key: string): Promise<StorageObjectMetadata>;
}
