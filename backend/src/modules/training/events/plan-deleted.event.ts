/** Emitted after a plan is soft-deleted. */
export class PlanDeletedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly planId: string,
  ) {}
}
