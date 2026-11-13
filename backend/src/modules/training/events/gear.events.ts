export class GearUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly athleteId: string,
    public readonly gearId: string | null,
  ) {}
}

export class GearReplaceSoonEvent {
  constructor(
    public readonly userId: string,
    public readonly athleteId: string,
    public readonly gearId: string,
    public readonly distanceKm: number,
    public readonly limitKm: number,
    public readonly gearName: string = '',
  ) {}
}
