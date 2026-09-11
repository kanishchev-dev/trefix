export class PlanAdaptedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly planId: string,
    public readonly reason: string,
  ) {}
}
