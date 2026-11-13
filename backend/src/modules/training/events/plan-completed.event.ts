/** Emitted after an active plan is completed. */
export class PlanCompletedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly planId: string,
  ) {}
}
