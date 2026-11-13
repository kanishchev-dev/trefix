export class StorageFileUploadedEvent {
  constructor(
    public readonly fileId: string,
    public readonly storageKey: string,
    public readonly uploaderUserId: string | null,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly scopeType: string | null,
    public readonly scopeId: string | null,
  ) {}
}
