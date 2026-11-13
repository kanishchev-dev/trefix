import { useRef, useState } from "react";
import {
  type ManualPlanPreview,
  type ManualPlanPreviewWorkout,
} from "@trefix/api-client";

import {
  validateWorkoutChanges,
  type WorkoutChanges,
} from "../components/workout-edit-form";
import {
  EMPTY_PREVIEW_EDITS,
  resolvePreview,
  withWorkoutChanges,
  withWorkoutRemoved,
  type PlanAddition,
  type PreviewEdits,
} from "../preview-edits";

/**
 * Local edits of a plan preview. Changes are checked against a client-side
 * mirror of the engine rules; the server re-validates everything on save.
 */
export function usePreviewEdits(preview: ManualPlanPreview) {
  const [edits, setEdits] = useState<PreviewEdits>(EMPTY_PREVIEW_EDITS);
  const [editError, setEditError] = useState<string | null>(null);
  const additionSeq = useRef(0);

  /** `false` when the change breaks a rule; the reason is in `editError`. */
  const change = (
    workoutId: string,
    weekNumber: number,
    changes: WorkoutChanges,
  ): boolean => {
    const error = validateWorkoutChanges(changes);
    setEditError(error);
    if (error) {
      return false;
    }
    setEdits((current) =>
      withWorkoutChanges(current, workoutId, weekNumber, changes),
    );
    return true;
  };

  const remove = (workout: ManualPlanPreviewWorkout) => {
    setEdits((current) => withWorkoutRemoved(current, workout));
  };

  const add = (input: Omit<PlanAddition, "localId">): boolean => {
    const error = validateWorkoutChanges(input);
    setEditError(error);
    if (error) {
      return false;
    }
    additionSeq.current += 1;
    const localId = String(additionSeq.current);
    setEdits((current) => ({
      ...current,
      additions: [...current.additions, { ...input, localId }],
    }));
    return true;
  };

  return {
    edits,
    editError,
    setEditError,
    change,
    remove,
    add,
    ...resolvePreview(preview, edits),
  };
}
