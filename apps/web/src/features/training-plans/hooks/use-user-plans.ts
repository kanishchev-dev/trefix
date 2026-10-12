"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import type {
  CreateManualPlanInput,
  CurrentMetrics,
  PlanChangeRequest,
  PlanCounts,
  PlanDetails,
  PlanListGroup,
  PlanListResponse,
  PlanStartOptions,
  PreviewManualPlanInput,
  RebuildInput,
  RebuildPrefill,
  RebuildPreviewInput,
  StartPlanInput,
  UpdatePlanMetaInput,
  UpdatePlanStructureInput,
} from "@trefix/api-client";

import {
  applyPlanChanges,
  cancelPlan,
  createManualPlan,
  deletePlan,
  fetchCurrentMetrics,
  fetchPlan,
  fetchPlanCounts,
  fetchPlans,
  fetchRebuildPrefill,
  fetchStartOptions,
  previewManualPlan,
  previewPlanChanges,
  previewRebuild,
  rebuildPlan,
  startPlan,
  updatePlanMeta,
  updatePlanStructure,
} from "@/entities/training-plan/api";
import { trainingCalendarKeys } from "@/features/training-calendar/hooks/use-training-calendar";

export const PLANS_PAGE_SIZE = 10;

export const userPlanKeys = {
  all: ["user-plans"] as const,
  user: (userId: string) => [...userPlanKeys.all, userId] as const,
  counts: (userId: string) => [...userPlanKeys.user(userId), "counts"] as const,
  list: (userId: string, group: PlanListGroup, page: number) =>
    [...userPlanKeys.user(userId), "list", group, page] as const,
  detail: (userId: string, planId: string) =>
    [...userPlanKeys.user(userId), "detail", planId] as const,
  startOptions: (userId: string, planId: string, timezone: string) =>
    [...userPlanKeys.user(userId), "start-options", planId, timezone] as const,
  rebuildPrefill: (userId: string, planId: string, timezone: string) =>
    [
      ...userPlanKeys.user(userId),
      "rebuild-prefill",
      planId,
      timezone,
    ] as const,
  currentMetrics: (userId: string) =>
    [...userPlanKeys.user(userId), "current-metrics"] as const,
};

// ------------------------------------------------------------------ queries

export function usePlanCounts(userId: string): UseQueryResult<PlanCounts> {
  return useQuery({
    queryKey: userPlanKeys.counts(userId),
    queryFn: () => fetchPlanCounts(userId),
  });
}

export function usePlans(
  userId: string,
  group: PlanListGroup,
  page: number,
): UseQueryResult<PlanListResponse> {
  return useQuery({
    queryKey: userPlanKeys.list(userId, group, page),
    queryFn: () => fetchPlans(userId, { group, page, limit: PLANS_PAGE_SIZE }),
    placeholderData: keepPreviousData,
  });
}

export function usePlan(
  userId: string,
  planId: string,
): UseQueryResult<PlanDetails> {
  return useQuery({
    queryKey: userPlanKeys.detail(userId, planId),
    queryFn: () => fetchPlan(userId, planId),
  });
}

export function useStartOptions(
  userId: string,
  planId: string,
  timezone: string,
  enabled: boolean,
): UseQueryResult<PlanStartOptions> {
  return useQuery({
    queryKey: userPlanKeys.startOptions(userId, planId, timezone),
    queryFn: () => fetchStartOptions(userId, planId, { timezone }),
    enabled,
  });
}

export function useCurrentMetrics(
  userId: string,
  enabled = true,
): UseQueryResult<CurrentMetrics> {
  return useQuery({
    queryKey: userPlanKeys.currentMetrics(userId),
    queryFn: () => fetchCurrentMetrics(userId),
    enabled,
    // Seeds the wizard once; a background refetch must not reset what the admin typed.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

export function useRebuildPrefill(
  userId: string,
  planId: string,
  timezone: string,
): UseQueryResult<RebuildPrefill> {
  return useQuery({
    queryKey: userPlanKeys.rebuildPrefill(userId, planId, timezone),
    queryFn: () => fetchRebuildPrefill(userId, planId, timezone),
    // The prefill seeds a form once; refetching would reset what the admin already changed.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

// ------------------------------------------------------------------ previews

export function usePreviewManualPlan(userId: string) {
  return useMutation({
    mutationFn: (input: PreviewManualPlanInput) =>
      previewManualPlan(userId, input),
  });
}

export function usePreviewPlanChanges(userId: string, planId: string) {
  return useMutation({
    mutationFn: (input: PlanChangeRequest) =>
      previewPlanChanges(userId, planId, input),
  });
}

export function usePreviewRebuild(userId: string, planId: string) {
  return useMutation({
    mutationFn: (input: RebuildPreviewInput) =>
      previewRebuild(userId, planId, input),
  });
}

// ------------------------------------------------------------------ mutations

/**
 * Plan mutations move dated workouts, so the user's calendar is refreshed
 * together with every cached plan list, count and detail.
 */
function useInvalidateUserTraining(userId: string): () => Promise<void> {
  const queryClient = useQueryClient();

  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: userPlanKeys.user(userId) }),
      queryClient.invalidateQueries({
        queryKey: trainingCalendarKeys.user(userId),
      }),
    ]);
  };
}

export function useCreateManualPlan(userId: string) {
  const invalidate = useInvalidateUserTraining(userId);
  return useMutation({
    mutationFn: (input: CreateManualPlanInput) =>
      createManualPlan(userId, input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdatePlanMeta(userId: string, planId: string) {
  const invalidate = useInvalidateUserTraining(userId);
  return useMutation({
    mutationFn: (input: UpdatePlanMetaInput) =>
      updatePlanMeta(userId, planId, input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdatePlanStructure(userId: string, planId: string) {
  const invalidate = useInvalidateUserTraining(userId);
  return useMutation({
    mutationFn: (input: UpdatePlanStructureInput) =>
      updatePlanStructure(userId, planId, input),
    onSuccess: () => invalidate(),
  });
}

export function useDeletePlan(userId: string) {
  const invalidate = useInvalidateUserTraining(userId);
  return useMutation({
    mutationFn: (planId: string) => deletePlan(userId, planId),
    onSuccess: () => invalidate(),
  });
}

export function useStartPlan(userId: string, planId: string) {
  const invalidate = useInvalidateUserTraining(userId);
  return useMutation({
    mutationFn: (input: StartPlanInput) => startPlan(userId, planId, input),
    onSuccess: () => invalidate(),
  });
}

export function useCancelPlan(userId: string, planId: string) {
  const invalidate = useInvalidateUserTraining(userId);
  return useMutation({
    mutationFn: (timezone: string) => cancelPlan(userId, planId, timezone),
    onSuccess: () => invalidate(),
  });
}

export function useApplyPlanChanges(userId: string, planId: string) {
  const invalidate = useInvalidateUserTraining(userId);
  return useMutation({
    mutationFn: (input: PlanChangeRequest) =>
      applyPlanChanges(userId, planId, input),
    onSuccess: () => invalidate(),
  });
}

export function useRebuildPlan(userId: string, planId: string) {
  const invalidate = useInvalidateUserTraining(userId);
  return useMutation({
    mutationFn: (input: RebuildInput) => rebuildPlan(userId, planId, input),
    onSuccess: () => invalidate(),
  });
}
