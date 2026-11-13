/** Emitted after a draft plan becomes active. */
export class PlanStartedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly planId: string,
    public readonly replacedPlanId?: string | null,
  ) {}
}
