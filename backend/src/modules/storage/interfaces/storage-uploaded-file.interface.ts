export interface StorageUploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  path?: string;
  buffer?: Buffer;
}
