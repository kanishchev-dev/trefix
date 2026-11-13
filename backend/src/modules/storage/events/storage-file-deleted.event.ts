export class StorageFileDeletedEvent {
  constructor(
    public readonly fileId: string,
    public readonly storageKey: string,
    public readonly uploaderUserId: string | null,
    public readonly scopeType: string | null,
    public readonly scopeId: string | null,
  ) {}
}
