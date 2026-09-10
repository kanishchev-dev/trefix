export interface StorageAccessContext {
  requesterUserId?: string;
}

export interface StorageUploadContext {
  uploaderUserId?: string;
  scopeType?: string;
  scopeId?: string;
  folder?: string;
}
