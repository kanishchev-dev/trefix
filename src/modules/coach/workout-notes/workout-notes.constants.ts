import { type PreferenceLanguage } from '@/modules/users/users.constants';

export const COACH_WORKOUT_NOTE_QUEUE = 'coach-workout-note';
export const COACH_WORKOUT_NOTE_JOB = 'coach.workout_note.generate';

/** Realtime event telling the client a note is ready to be fetched. */
export const COACH_WORKOUT_NOTE_READY_EVENT = 'coach.workout_note.ready';

/**
 * Part of the input hash: bump it when the prompt changes so stored notes are
 * regenerated with the new wording on the next request.
 */
export const COACH_WORKOUT_NOTE_PROMPT_VERSION = 1;

/** Notes are short by design: they sit under the workout, not in a chat. */
export const COACH_WORKOUT_NOTE_MAX_LENGTH = 600;

export const COACH_WORKOUT_NOTE_STATUSES = ['ready', 'pending', 'disabled'] as const;
export type CoachWorkoutNoteStatus = (typeof COACH_WORKOUT_NOTE_STATUSES)[number];

export interface CoachWorkoutNoteJob {
  userId: string;
  workoutId: string;
  language: PreferenceLanguage;
}
