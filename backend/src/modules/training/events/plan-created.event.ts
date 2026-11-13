import type { PlanCreationSource, TrainingPlanStatus } from '../training.constants';

/** Emitted after a plan row is created in any status. */
export class PlanCreatedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly planId: string,
    public readonly status: TrainingPlanStatus,
    public readonly source: PlanCreationSource,
    public readonly sourcePlanId?: string | null,
  ) {}
}
