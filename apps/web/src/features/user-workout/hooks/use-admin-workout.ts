"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";

import type {
  CoachWorkoutNote,
  CompleteWorkoutInput,
  PendingAdaptation,
  TrainingWorkout,
  WorkoutRecording,
  WorkoutSources,
} from "@trefix/api-client";

import {
  completeAdminWorkout,
  decideAdminAdaptation,
  deleteAdminWorkout,
  deleteAdminWorkoutNote,
  fetchAdminAdaptations,
  fetchAdminWorkout,
  fetchAdminWorkoutNote,
  fetchAdminWorkoutRecording,
  fetchAdminWorkoutSources,
  regenerateAdminWorkoutNote,
  reopenAdminWorkout,
  setAdminWorkoutGear,
  setAdminWorkoutRecordsExcluded,
  unlinkAdminWorkoutSource,
  updateAdminWorkoutResult,
} from "@/entities/admin-workout/api";
import {
  userCardKeys,
  useUserCardMutation,
} from "@/features/users/hooks/use-user-card-query";
import { useI18n } from "@/shared/i18n";

const WORKOUT = "workout";
const ADAPTATIONS = "adaptations";
/** Sections whose numbers depend on a workout's result. */
const AFFECTED = [WORKOUT, "progress", "gear", "calendar", ADAPTATIONS];

const workoutKey = (userId: string, workoutId: string) =>
  [...userCardKeys.section(userId, WORKOUT), workoutId] as const;

export function useAdminWorkout(
  userId: string,
  workoutId: string,
): UseQueryResult<TrainingWorkout> {
  return useQuery({
    queryKey: workoutKey(userId, workoutId),
    queryFn: () => fetchAdminWorkout(userId, workoutId),
    retry: false,
  });
}

export function useWorkoutSources(
  userId: string,
  workoutId: string,
  enabled: boolean,
): UseQueryResult<WorkoutSources> {
  return useQuery({
    queryKey: [...workoutKey(userId, workoutId), "sources"],
    queryFn: () => fetchAdminWorkoutSources(userId, workoutId),
    enabled,
  });
}

export function useWorkoutNote(
  userId: string,
  workoutId: string,
  enabled: boolean,
): UseQueryResult<CoachWorkoutNote> {
  return useQuery({
    queryKey: [...workoutKey(userId, workoutId), "note"],
    queryFn: () => fetchAdminWorkoutNote(userId, workoutId),
    enabled,
    retry: false,
  });
}

export function useWorkoutRecording(
  userId: string,
  workoutId: string,
  enabled: boolean,
): UseQueryResult<WorkoutRecording> {
  return useQuery({
    queryKey: [...workoutKey(userId, workoutId), "recording"],
    queryFn: () => fetchAdminWorkoutRecording(userId, workoutId),
    enabled,
    retry: false,
  });
}

export function useWorkoutActions(userId: string, workoutId: string) {
  const { t } = useI18n();
  return {
    complete: useUserCardMutation(userId, {
      mutationFn: (input: CompleteWorkoutInput) =>
        completeAdminWorkout(userId, workoutId, input),
      sections: AFFECTED,
      successMessage: t("userCard.workout.toasts.completed"),
    }),
    updateResult: useUserCardMutation(userId, {
      mutationFn: (input: CompleteWorkoutInput) =>
        updateAdminWorkoutResult(userId, workoutId, input),
      sections: AFFECTED,
      successMessage: t("userCard.workout.toasts.resultUpdated"),
    }),
    reopen: useUserCardMutation(userId, {
      mutationFn: () => reopenAdminWorkout(userId, workoutId),
      sections: AFFECTED,
      successMessage: t("userCard.workout.toasts.reopened"),
    }),
    remove: useUserCardMutation(userId, {
      mutationFn: () => deleteAdminWorkout(userId, workoutId),
      sections: AFFECTED,
      successMessage: t("userCard.workout.toasts.deleted"),
    }),
    setGear: useUserCardMutation(userId, {
      mutationFn: (gearId: string | null) =>
        setAdminWorkoutGear(userId, workoutId, gearId),
      sections: AFFECTED,
      successMessage: t("userCard.workout.toasts.gearSet"),
    }),
    setRecordsExcluded: useUserCardMutation(userId, {
      mutationFn: (excluded: boolean) =>
        setAdminWorkoutRecordsExcluded(userId, workoutId, excluded),
      sections: AFFECTED,
      successMessage: (excluded: boolean) =>
        excluded
          ? t("userCard.workout.toasts.recordsExcluded")
          : t("userCard.workout.toasts.recordsIncluded"),
    }),
    unlinkSource: useUserCardMutation(userId, {
      mutationFn: (provider: string) =>
        unlinkAdminWorkoutSource(userId, workoutId, provider),
      sections: AFFECTED,
      successMessage: t("userCard.workout.toasts.sourceUnlinked"),
    }),
    regenerateNote: useUserCardMutation(userId, {
      mutationFn: () => regenerateAdminWorkoutNote(userId, workoutId),
      sections: [WORKOUT, "coach"],
      successMessage: t("userCard.workout.toasts.noteRegenerated"),
    }),
    deleteNote: useUserCardMutation(userId, {
      mutationFn: () => deleteAdminWorkoutNote(userId, workoutId),
      sections: [WORKOUT, "coach"],
      successMessage: t("userCard.workout.toasts.noteDeleted"),
    }),
  };
}

export function useAdminAdaptations(
  userId: string,
): UseQueryResult<PendingAdaptation[]> {
  return useQuery({
    queryKey: userCardKeys.section(userId, ADAPTATIONS),
    queryFn: () => fetchAdminAdaptations(userId),
    retry: false,
  });
}

export function useDecideAdaptation(userId: string) {
  const { t } = useI18n();
  return useUserCardMutation(userId, {
    mutationFn: ({
      adaptationId,
      decision,
    }: {
      adaptationId: string;
      decision: "apply" | "dismiss";
    }) => decideAdminAdaptation(userId, adaptationId, decision),
    sections: [ADAPTATIONS, "calendar", "plans"],
    successMessage: (adaptation) =>
      adaptation.status === "dismissed"
        ? t("userCard.adaptations.toasts.dismissed")
        : t("userCard.adaptations.toasts.applied"),
  });
}
