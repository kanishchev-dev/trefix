export class GoalCreatedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly goalId: string,
  ) {}
}
