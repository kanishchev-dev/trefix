export class PlanGeneratedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly planId: string,
  ) {}
}
