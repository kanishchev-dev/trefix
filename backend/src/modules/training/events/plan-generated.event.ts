import type { PlanCreationSource } from '../training.constants';

export class PlanGeneratedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly planId: string,
    public readonly creationSource: PlanCreationSource = 'ai',
  ) {}
}
