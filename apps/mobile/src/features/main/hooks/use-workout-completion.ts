import { useCallback, useState } from "react";
import { type TrainingWorkout } from "@trefix/api-client";

import { type MainCopy } from "../../../locales";
import { getErrorMessage } from "../../../shared/lib/error-message";
import {
  parseCompletionForm,
  type CompletionForm,
} from "../lib/workout-detail-rules";
import { useCompleteWorkout } from "./use-workouts";

const EMPTY_FORM: CompletionForm = {
  distanceKm: "",
  durationMinutes: "",
  heartRate: "",
  rpe: "",
  notes: "",
};

/** Manual completion of a workout: the form, its validation and the request. */
export function useWorkoutCompletion(copy: MainCopy, onCompleted: () => void) {
  const completeWorkout = useCompleteWorkout();
  const [isCompleting, setIsCompleting] = useState(false);
  const [form, setForm] = useState<CompletionForm>(EMPTY_FORM);
  const [errorMessage, setErrorMessage] = useState("");

  const setField = (field: keyof CompletionForm) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

  /** Opens the form prefilled with the plan, so a run done as planned is one tap. */
  const start = (workout: TrainingWorkout) => {
    setForm({
      ...EMPTY_FORM,
      distanceKm: String(workout.distanceKm || "5"),
      durationMinutes: String(workout.durationMinutes || "30"),
    });
    setIsCompleting(true);
    setErrorMessage("");
  };

  // Stable: the sheet resets the form in an effect whenever it opens.
  const reset = useCallback(() => {
    setIsCompleting(false);
    setErrorMessage("");
  }, []);

  const save = async (workoutId: string) => {
    setErrorMessage("");
    const parsed = parseCompletionForm(form);
    if (!parsed.ok) {
      setErrorMessage(
        parsed.field === "distance"
          ? copy.today.addSheet.invalidDistance
          : copy.today.addSheet.invalidDuration,
      );
      return;
    }
    try {
      await completeWorkout.mutateAsync({ workoutId, dto: parsed.input });
      setIsCompleting(false);
      onCompleted();
    } catch (error: unknown) {
      setErrorMessage(
        getErrorMessage(error, copy.errors, copy.errors.completeWorkoutFailed),
      );
    }
  };

  return {
    isCompleting,
    isSaving: completeWorkout.isPending,
    form,
    setField,
    errorMessage,
    start,
    reset,
    cancel: () => setIsCompleting(false),
    save,
  };
}
