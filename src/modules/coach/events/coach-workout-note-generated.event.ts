export class CoachWorkoutNoteGeneratedEvent {
  constructor(
    public readonly userId: string,
    public readonly workoutId: string,
    public readonly noteId: string,
    public readonly language: string,
  ) {}
}
