import type {
  AdaptationEventView,
  AthleteStateView,
  AthleteView,
  GoalView,
  TrainingPlanView,
  WorkoutView,
} from '../training/interfaces/training-views.interface';
import { COACH_TONE_DEFAULT, type CoachTone } from '../users/users.constants';
import { COACH_CHAT_HISTORY_LIMIT, COACH_CONTEXT_WORKOUT_LIMIT, COACH_TOOL_NAMES } from './coach.constants';
import { CoachMessageResponseDto, CoachSessionResponseDto } from './dto/coach-response.dto';

export interface CoachContextInput {
  session: CoachSessionResponseDto;
  athlete: AthleteView;
  state: AthleteStateView;
  goal: GoalView | null;
  plan: TrainingPlanView | null;
  /** Latest edits the user made to the active plan. */
  recentPlanEdits?: AdaptationEventView[];
  recentWorkouts: WorkoutView[];
  recentMessages: CoachMessageResponseDto[];
}

const TONE_INSTRUCTIONS: Record<CoachTone, string> = {
  soft: 'Speak warmly and encouragingly; praise effort and frame corrections gently.',
  neutral: 'Speak in a calm, matter-of-fact tone.',
  strict: 'Speak directly and demandingly; point out deviations from the plan plainly, without softening.',
};

export class CoachPromptBuilder {
  buildInstructions(tone: CoachTone = COACH_TONE_DEFAULT): string {
    return [
      'You are the Trefix running coach.',
      'Training decisions are produced by the deterministic training engine.',
      'Do not invent workouts or training changes that are not grounded in the provided context or tool results.',
      'If information is missing, ask one short clarifying question.',
      'Prefer conservative progression when confidence is low.',
      'Use the controlled tools only for evidence gathering or validated plan changes.',
      'Allowed tools include state lookup, plan lookup, workout lookup, workout analysis, and controlled plan adjustment.',
      TONE_INSTRUCTIONS[tone] ?? TONE_INSTRUCTIONS[COACH_TONE_DEFAULT],
      'Respond with valid JSON that matches the requested schema.',
    ].join(' ');
  }

  buildContextMessage(context: CoachContextInput): string {
    return JSON.stringify(
      {
        session: context.session,
        athlete: context.athlete,
        athleteState: context.state,
        goal: context.goal,
        plan: context.plan,
        recentPlanEdits: context.recentPlanEdits ?? [],
        recentWorkouts: context.recentWorkouts.slice(0, COACH_CONTEXT_WORKOUT_LIMIT),
        recentMessages: context.recentMessages.slice(-COACH_CHAT_HISTORY_LIMIT),
        toolNames: COACH_TOOL_NAMES,
      },
      null,
      2,
    );
  }
}
