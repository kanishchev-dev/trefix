import { createHash } from 'node:crypto';

import type { GoalView, WorkoutView } from '@/modules/training/interfaces/training-views.interface';
import { type PreferenceLanguage } from '@/modules/users/users.constants';

import type { OpenAiInputMessage } from '../../openai/interfaces/openai-types.interface';
import { COACH_WORKOUT_NOTE_MAX_LENGTH, COACH_WORKOUT_NOTE_PROMPT_VERSION } from './workout-notes.constants';

const LANGUAGE_NAMES: Record<PreferenceLanguage, string> = {
  ru: 'Russian (address the athlete politely with «вы»)',
  en: 'English',
};

export const COACH_WORKOUT_NOTE_SCHEMA = {
  type: 'object',
  properties: {
    note: { type: 'string' },
  },
  required: ['note'],
  additionalProperties: false,
} as const;

export interface CoachWorkoutNoteDraft {
  note: string;
}

export interface WorkoutNoteContext {
  workout: WorkoutView;
  goal: GoalView | null;
}

/** Only what the note is written from: a change here makes the stored note stale. */
function promptFacts({ workout, goal }: WorkoutNoteContext): Record<string, unknown> {
  return {
    sport: workout.sport,
    type: workout.type,
    phase: workout.phase,
    status: workout.status,
    scheduledDate: workout.scheduledAt.toISOString().slice(0, 10),
    weekNumber: workout.planId ? workout.weekNumber : null,
    durationMinutes: workout.durationMinutes,
    distanceKm: workout.distanceKm,
    target: workout.target,
    steps: workout.steps,
    actual: workout.status === 'completed' ? workout.actual : null,
    goal: goal
      ? {
          type: goal.type,
          raceDistance: goal.raceDistance,
          targetTimeSeconds: goal.targetTimeSeconds,
          targetDate: goal.targetDate,
        }
      : null,
  };
}

export function workoutNoteInputHash(context: WorkoutNoteContext, language: PreferenceLanguage): string {
  return createHash('sha256')
    .update(JSON.stringify({ v: COACH_WORKOUT_NOTE_PROMPT_VERSION, language, facts: promptFacts(context) }))
    .digest('hex');
}

export function workoutNoteInstructions(language: PreferenceLanguage): string {
  return [
    'You are Tref, the AI running coach of the Trefix app, writing a short note that is shown under one workout.',
    'The sport is run, walk, hike or strength: walks, hikes and strength sessions support the running preparation,',
    'so say how they help the runner; for strength there is no distance or pace.',
    'For a planned workout: say why this session matters at this point of the plan and how to run it',
    '(effort and pace cues from the target and steps), plus one practical tip.',
    'For a completed workout: briefly compare what was done with the plan and say what it means for the next days.',
    'Use only the facts provided; never invent numbers, paces or plan changes.',
    `Two to four sentences, at most ${COACH_WORKOUT_NOTE_MAX_LENGTH} characters, plain text without markdown or emoji.`,
    `Write in ${LANGUAGE_NAMES[language]}. Paces in target and steps are seconds per kilometre: write them as m:ss.`,
    'Respond with JSON that matches the schema.',
  ].join(' ');
}

export function workoutNoteInput(context: WorkoutNoteContext): OpenAiInputMessage[] {
  return [
    {
      role: 'user',
      content: [{ type: 'input_text', text: JSON.stringify(promptFacts(context), null, 2) }],
    },
  ];
}
