export class IntegrationDisconnectedEvent {
  constructor(
    public readonly integrationId: string,
    public readonly athleteId: string,
    public readonly provider: string,
  ) {}
}
