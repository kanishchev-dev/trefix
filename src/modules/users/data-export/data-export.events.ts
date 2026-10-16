export class DataExportRequestedEvent {
  constructor(
    public readonly userId: string,
    public readonly exportId: string,
  ) {}
}

export class DataExportReadyEvent {
  constructor(
    public readonly userId: string,
    public readonly exportId: string,
  ) {}
}
