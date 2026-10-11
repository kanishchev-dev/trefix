import { useGoalFormKit, type GoalFormProps } from "./use-goal-form-kit";
import { renderChallengeGoalForm } from "./goal-forms/challenge-goal-forms";
import { renderHabitGoalForm } from "./goal-forms/habit-goal-forms";
import { renderPerformanceGoalForm } from "./goal-forms/performance-goal-forms";
import { renderRaceGoalForm } from "./goal-forms/race-goal-forms";

type Props = GoalFormProps;

/**
 * Goal setup step.
 * - "Goal": what the plan is built for. Required fields are pre-filled on
 *   type selection (withRequiredGoalDefaults); optional ones sit behind
 *   "+ Add …" links.
 * - "Current level" and "Target date" are optional sections revealed by a
 *   link; opening one stores its defaults, removing it clears them.
 * - Only metric keys allowed for the goal type are written, in canonical
 *   units (metres, seconds, minutes) — the backend rejects anything else.
 */ export function GoalSetupStep(props: Props) {
  const kit = useGoalFormKit(props);
  return (
    renderRaceGoalForm(props.goalType, kit) ??
    renderPerformanceGoalForm(props.goalType, kit) ??
    renderHabitGoalForm(props.goalType, kit) ??
    renderChallengeGoalForm(props.goalType, kit)
  );
}
