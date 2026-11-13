"use client";

import {
  useMutation,
  useQueryClient,
  type UseMutationResult,
} from "@tanstack/react-query";

import { trainingCalendarKeys } from "@/features/training-calendar/hooks/use-training-calendar";
import { userPlanKeys } from "@/features/training-plans/hooks/use-user-plans";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";

import { userKeys } from "./use-users";

/** Query keys of a user's card: one branch per section, all under the user. */
export const userCardKeys = {
  all: ["user-card"] as const,
  user: (userId: string) => [...userCardKeys.all, userId] as const,
  section: (userId: string, section: string) =>
    [...userCardKeys.user(userId), section] as const,
};

/** Sections that keep their data under keys of their own features. */
const FEATURE_KEYS: Record<string, (userId: string) => readonly unknown[]> = {
  calendar: trainingCalendarKeys.user,
  plans: userPlanKeys.user,
};

function sectionKey(userId: string, section: string): readonly unknown[] {
  return (
    FEATURE_KEYS[section]?.(userId) ?? userCardKeys.section(userId, section)
  );
}

/**
 * Mutation of a card section: shows the outcome as a toast and refreshes the
 * affected sections, the activity history (every change lands there) and the
 * user record itself (status, email).
 */
export function useUserCardMutation<TVariables, TResult = unknown>(
  userId: string,
  options: {
    mutationFn: (variables: TVariables) => Promise<TResult>;
    sections: readonly string[];
    successMessage?: string | ((result: TResult) => string);
    onSuccess?: (result: TResult, variables: TVariables) => void;
  },
): UseMutationResult<TResult, unknown, TVariables> {
  const queryClient = useQueryClient();
  const { t } = useI18n();

  return useMutation({
    mutationFn: options.mutationFn,
    onSuccess: async (result, variables) => {
      if (options.successMessage) {
        notifySuccess(
          typeof options.successMessage === "function"
            ? options.successMessage(result)
            : options.successMessage,
        );
      }
      options.onSuccess?.(result, variables);
      await Promise.all([
        ...[...options.sections, "activity", "overview"].map((section) =>
          queryClient.invalidateQueries({
            queryKey: sectionKey(userId, section),
          }),
        ),
        queryClient.invalidateQueries({ queryKey: userKeys.detail(userId) }),
      ]);
    },
    onError: (error) =>
      notifyError(t("common.states.error"), getFriendlyApiMessage(error, t)),
  });
}
