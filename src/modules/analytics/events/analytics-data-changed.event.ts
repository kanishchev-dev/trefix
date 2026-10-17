/** The data behind the dashboard changed; blocks computed before `version` are stale. */
export class AnalyticsDataChangedEvent {
  constructor(
    public readonly version: number,
    public readonly changedAt: string,
  ) {}
}
