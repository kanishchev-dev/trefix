export class PlanAdaptedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly planId: string,
    public readonly reason: string,
  ) {}
}

/** An automatic adaptation was kept as a proposal (`proposed`) or advice (`suggested`) instead of being applied. */
export class PlanAdaptationProposedEvent {
  constructor(
    public readonly userId: string,
    public readonly athleteId: string,
    public readonly planId: string | null,
    public readonly adaptationId: string,
    public readonly status: string,
    /** Adaptation action (`REDUCE_VOLUME`, `UPDATE_HEART_RATE`, …). */
    public readonly action: string = '',
    public readonly changesCount: number = 0,
  ) {}
}
