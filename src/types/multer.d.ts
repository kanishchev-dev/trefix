declare module 'multer' {
  import { StorageUploadedFile } from '../modules/storage/interfaces/storage-uploaded-file.interface';

  export interface DiskStorageOptions {
    destination?: (
      req: import('express').Request,
      file: StorageUploadedFile,
      callback: (error: Error | null, destination: string) => void,
    ) => void;
    filename?: (
      req: import('express').Request,
      file: StorageUploadedFile,
      callback: (error: Error | null, filename: string) => void,
    ) => void;
  }

  export interface StorageEngine {
    _handleFile?: unknown;
    _removeFile?: unknown;
  }

  export function diskStorage(options: DiskStorageOptions): StorageEngine;

  const multer: {
    diskStorage: typeof diskStorage;
  };

  export default multer;
}
