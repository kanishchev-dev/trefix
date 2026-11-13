export const COACH_MODULE_NAME = 'CoachModule';
export const COACH_DEFAULT_TITLE = 'Training Coach';
export const COACH_CONTEXT_WORKOUT_LIMIT = 10;
export const COACH_CHAT_HISTORY_LIMIT = 12;

export const COACH_MESSAGE_ROLES = ['user', 'assistant', 'tool'] as const;
export const COACH_TOOL_NAMES = [
  'getAthleteState',
  'getCurrentPlan',
  'getRecentWorkouts',
  'getGoal',
  'getWorkout',
  'analyzeWorkout',
  'moveWorkout',
  'replaceWorkout',
  'adjustPlan',
] as const;

export type CoachMessageRole = (typeof COACH_MESSAGE_ROLES)[number];
export type CoachToolName = (typeof COACH_TOOL_NAMES)[number];
