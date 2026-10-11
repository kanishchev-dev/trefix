import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type PlanDetails,
  type PlanListResponse,
  type PlanMetaResponse,
  type PlanOverview,
  type UpdatePlanStructureInput,
} from "@workspace/api-client";
import { type InfiniteData } from "@tanstack/react-query";

import {
  deletePlan,
  getPlan,
  patchPlan,
  updateDraftStructure,
} from "../../../lib/training-api";
import { trackEvent } from "../../../lib/analytics";
import { invalidatePlanQueries, planKeys } from "./plan-query-keys";

export function usePlanDetails(planId: string | null | undefined) {
  return useQuery({
    queryKey: planKeys.detail(planId ?? ""),
    queryFn: () => getPlan(planId as string),
    enabled: Boolean(planId),
  });
}

type MetaVariables = {
  planId: string;
  name?: string;
  notes?: string | null;
  expectedVersion: number;
};

type MetaSnapshot = Array<[readonly unknown[], unknown]>;

/**
 * Name and notes. Updated optimistically in the list, details and overview
 * caches and rolled back if the server refuses.
 */
export function useUpdatePlanMeta() {
  const queryClient = useQueryClient();

  return useMutation<PlanMetaResponse, Error, MetaVariables, MetaSnapshot>({
    mutationFn: ({ planId, ...dto }) => patchPlan(planId, dto),
    onMutate: async ({ planId, name, notes }) => {
      const keys = [
        planKeys.detail(planId),
        planKeys.lists(),
        planKeys.overview(),
      ];
      await Promise.all(
        keys.map((queryKey) => queryClient.cancelQueries({ queryKey })),
      );
      const snapshot: MetaSnapshot = [];
      for (const queryKey of keys) {
        for (const [key, data] of queryClient.getQueriesData({ queryKey }))
          snapshot.push([key, data]);
      }

      queryClient.setQueryData<PlanDetails>(
        planKeys.detail(planId),
        (current) =>
          current
            ? {
                ...current,
                name: name ?? current.name,
                notes: notes !== undefined ? notes : current.notes,
              }
            : current,
      );
      queryClient.setQueriesData<InfiniteData<PlanListResponse>>(
        { queryKey: planKeys.lists() },
        (current) =>
          current
            ? {
                ...current,
                pages: current.pages.map((page) => ({
                  ...page,
                  items: page.items.map((item) =>
                    item.id === planId
                      ? {
                          ...item,
                          name: name ?? item.name,
                          notesPreview:
                            notes !== undefined
                              ? (notes?.slice(0, 160) ?? null)
                              : item.notesPreview,
                        }
                      : item,
                  ),
                })),
              }
            : current,
      );
      queryClient.setQueryData<PlanOverview>(planKeys.overview(), (current) =>
        current && current.plan.id === planId
          ? {
              ...current,
              plan: {
                ...current.plan,
                name: name ?? current.plan.name,
                notes: notes !== undefined ? notes : current.plan.notes,
              },
            }
          : current,
      );
      return snapshot;
    },
    onError: (_error, _variables, snapshot) => {
      for (const [key, data] of snapshot ?? [])
        queryClient.setQueryData(key, data);
    },
    onSuccess: (_result, { name, notes }) => {
      trackEvent("plan_meta_updated", {
        fields: [
          name !== undefined ? "name" : null,
          notes !== undefined ? "notes" : null,
        ]
          .filter(Boolean)
          .join(","),
      });
    },
    onSettled: () => invalidatePlanQueries(queryClient, "meta"),
  });
}

export function useDeletePlan() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { planId: string; status: string }>({
    mutationFn: ({ planId }) => deletePlan(planId),
    onSuccess: (_result, { planId, status }) => {
      trackEvent("plan_deleted", { status });
      queryClient.removeQueries({ queryKey: planKeys.detail(planId) });
      invalidatePlanQueries(queryClient, "library");
    },
  });
}

export function useUpdateDraftStructure() {
  const queryClient = useQueryClient();
  return useMutation<
    { version: number },
    Error,
    { planId: string } & UpdatePlanStructureInput
  >({
    mutationFn: ({ planId, ...dto }) => updateDraftStructure(planId, dto),
    onSuccess: (_result, { planId }) =>
      invalidatePlanQueries(queryClient, "draftStructure", planId),
  });
}
