import type {
  AthleteStateView,
  AthleteView,
  GoalView,
  TrainingPlanView,
  WorkoutView,
} from '../training/interfaces/training-views.interface';
import { COACH_CHAT_HISTORY_LIMIT, COACH_CONTEXT_WORKOUT_LIMIT, COACH_TOOL_NAMES } from './coach.constants';
import { CoachMessageResponseDto, CoachSessionResponseDto } from './dto/coach-response.dto';

export interface CoachContextInput {
  session: CoachSessionResponseDto;
  athlete: AthleteView;
  state: AthleteStateView;
  goal: GoalView | null;
  plan: TrainingPlanView | null;
  recentWorkouts: WorkoutView[];
  recentMessages: CoachMessageResponseDto[];
}

export class CoachPromptBuilder {
  buildInstructions(): string {
    return [
      'You are the Trefix running coach.',
      'Training decisions are produced by the deterministic training engine.',
      'Do not invent workouts or training changes that are not grounded in the provided context or tool results.',
      'If information is missing, ask one short clarifying question.',
      'Prefer conservative progression when confidence is low.',
      'Use the controlled tools only for evidence gathering or validated plan changes.',
      'Allowed tools include state lookup, plan lookup, workout lookup, workout analysis, and controlled plan adjustment.',
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
        recentWorkouts: context.recentWorkouts.slice(0, COACH_CONTEXT_WORKOUT_LIMIT),
        recentMessages: context.recentMessages.slice(-COACH_CHAT_HISTORY_LIMIT),
        toolNames: COACH_TOOL_NAMES,
      },
      null,
      2,
    );
  }
}
