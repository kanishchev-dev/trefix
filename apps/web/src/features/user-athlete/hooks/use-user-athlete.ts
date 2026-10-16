"use client";

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useMemo } from "react";

import type {
  AthleteProfile,
  AthleteProfileUpdate,
  GearInput,
  GearList,
  ProgressSummary,
  RaceResultInput,
  RecordHistory,
} from "@trefix/api-client";

import {
  addUserResult,
  createUserGear,
  deleteUserGear,
  deleteUserResult,
  fetchUserAthlete,
  fetchUserGear,
  fetchUserProgressSummary,
  fetchUserRecordHistory,
  fetchUserRecords,
  setUserGearArchived,
  updateUserAthlete,
  updateUserGear,
  type ProgressRecords,
} from "@/entities/user-athlete/api";
import { getBrowserTimezone } from "@/features/training-calendar/lib/calendar-dates";
import {
  userCardKeys,
  useUserCardMutation,
} from "@/features/users/hooks/use-user-card-query";
import { useI18n } from "@/shared/i18n";

const ATHLETE = "athlete";
const PROGRESS = "progress";
const GEAR = "gear";

export function useUserAthlete(userId: string): UseQueryResult<AthleteProfile> {
  return useQuery({
    queryKey: userCardKeys.section(userId, ATHLETE),
    queryFn: () => fetchUserAthlete(userId),
    retry: false,
  });
}

export function useUpdateUserAthlete(userId: string) {
  const { t } = useI18n();
  return useUserCardMutation(userId, {
    mutationFn: (input: AthleteProfileUpdate) =>
      updateUserAthlete(userId, input),
    sections: [ATHLETE, PROGRESS],
    successMessage: t("userCard.athlete.toasts.saved"),
  });
}

export function useUserProgressSummary(
  userId: string,
): UseQueryResult<ProgressSummary> {
  const timezone = useMemo(() => getBrowserTimezone(), []);
  return useQuery({
    queryKey: [...userCardKeys.section(userId, PROGRESS), "summary"],
    queryFn: () => fetchUserProgressSummary(userId, timezone),
    retry: false,
  });
}

export function useUserRecords(
  userId: string,
): UseQueryResult<ProgressRecords> {
  return useQuery({
    queryKey: [...userCardKeys.section(userId, PROGRESS), "records"],
    queryFn: () => fetchUserRecords(userId),
    retry: false,
  });
}

export function useUserRecordHistory(
  userId: string,
  distance: string | null,
): UseQueryResult<RecordHistory> {
  return useQuery({
    queryKey: [...userCardKeys.section(userId, PROGRESS), "records", distance],
    queryFn: () => fetchUserRecordHistory(userId, distance ?? ""),
    enabled: distance !== null,
  });
}

export function useProgressActions(userId: string) {
  const { t } = useI18n();
  return {
    addResult: useUserCardMutation(userId, {
      mutationFn: (input: RaceResultInput) => addUserResult(userId, input),
      sections: [PROGRESS],
      successMessage: t("userCard.progress.toasts.resultAdded"),
    }),
    deleteResult: useUserCardMutation(userId, {
      mutationFn: (resultId: string) => deleteUserResult(userId, resultId),
      sections: [PROGRESS],
      successMessage: t("userCard.progress.toasts.resultDeleted"),
    }),
  };
}

export function useUserGear(
  userId: string,
  status: "active" | "retired",
): UseQueryResult<GearList> {
  return useQuery({
    queryKey: [...userCardKeys.section(userId, GEAR), status],
    queryFn: () => fetchUserGear(userId, status),
    retry: false,
  });
}

export function useGearActions(userId: string) {
  const { t } = useI18n();
  return {
    create: useUserCardMutation(userId, {
      mutationFn: (input: GearInput) => createUserGear(userId, input),
      sections: [GEAR],
      successMessage: t("userCard.gear.toasts.created"),
    }),
    update: useUserCardMutation(userId, {
      mutationFn: ({
        gearId,
        input,
      }: {
        gearId: string;
        input: Partial<GearInput>;
      }) => updateUserGear(userId, gearId, input),
      sections: [GEAR],
      successMessage: t("userCard.gear.toasts.updated"),
    }),
    setArchived: useUserCardMutation(userId, {
      mutationFn: ({
        gearId,
        archived,
      }: {
        gearId: string;
        archived: boolean;
      }) => setUserGearArchived(userId, gearId, archived),
      sections: [GEAR],
      successMessage: (gear) =>
        gear.status === "retired"
          ? t("userCard.gear.toasts.retired")
          : t("userCard.gear.toasts.restored"),
    }),
    remove: useUserCardMutation(userId, {
      mutationFn: (gearId: string) => deleteUserGear(userId, gearId),
      sections: [GEAR],
      successMessage: t("userCard.gear.toasts.deleted"),
    }),
  };
}
