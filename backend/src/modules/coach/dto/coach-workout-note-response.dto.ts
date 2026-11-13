import { ApiProperty } from '@nestjs/swagger';

import { COACH_WORKOUT_NOTE_STATUSES, type CoachWorkoutNoteStatus } from '../workout-notes/workout-notes.constants';

export class CoachWorkoutNoteResponseDto {
  @ApiProperty()
  workoutId!: string;

  @ApiProperty({
    enum: COACH_WORKOUT_NOTE_STATUSES,
    description:
      '`ready` — `content` holds the note; `pending` — it is being written, the client gets ' +
      '`coach.workout_note.ready` over realtime and fetches again; `disabled` — the coach is off.',
  })
  status!: CoachWorkoutNoteStatus;

  @ApiProperty({ type: String, nullable: true, description: 'Note text in the user language' })
  content!: string | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  generatedAt!: Date | null;
}
