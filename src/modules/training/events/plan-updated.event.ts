/** What kind of change touched the plan. */
export type PlanUpdateKind = 'meta' | 'structure' | 'workouts' | 'schedule' | 'goal_date' | 'rebuild';

/** Emitted after any edit of a plan. */
export class PlanUpdatedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly planId: string,
    public readonly kind: PlanUpdateKind,
  ) {}
}
