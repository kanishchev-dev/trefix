export class WorkoutCompletedEvent {
  constructor(
    public readonly athleteId: string,
    public readonly workoutId: string,
    public readonly load: number,
  ) {}
}
