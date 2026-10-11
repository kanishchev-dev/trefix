import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { WorkoutDetailSheet } from "../../main/components/today/workout-detail-sheet";
import { useWorkout } from "../hooks/use-workout";

type Props = {
  workoutId: string | null;
  onClose: () => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Workout sheet opened from a plan week: details, manual completion and edits. */
export function PlanWorkoutSheet({
  workoutId,
  onClose,
  theme,
  themeMode,
  copy,
  language,
}: Props) {
  const workoutQuery = useWorkout(workoutId);
  const workout = workoutId ? (workoutQuery.data ?? null) : null;

  return (
    <WorkoutDetailSheet
      workout={workout}
      visible={workout !== null}
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
      copy={copy}
      language={language}
    />
  );
}
