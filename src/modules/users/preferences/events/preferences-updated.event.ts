export class PreferencesUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly changedFields: string[],
  ) {}
}
