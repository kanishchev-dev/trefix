/** Emitted after an active plan is cancelled. */
export class PlanCancelledEvent {
  constructor(
    public readonly athleteId: string,
    public readonly planId: string,
    public readonly reason: string,
    public readonly cancelledWorkouts: number,
  ) {}
}
