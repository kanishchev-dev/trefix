import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { type GearInput, type GearStatus } from "@trefix/api-client";

import {
  createGear,
  deleteGear,
  getGear,
  importStravaGear,
  listGear,
  restoreGear,
  retireGear,
  updateGear,
} from "../../../lib/training-api";
import { queryKeys } from "../../../shared/lib/query-keys";

export function useGear(status: GearStatus = "active") {
  return useQuery({
    queryKey: queryKeys.gear.list(status),
    queryFn: () => listGear(status),
    staleTime: 1000 * 60 * 5,
  });
}

export function useGearItem(gearId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gear.detail(gearId ?? ""),
    queryFn: () => getGear(gearId!),
    enabled: Boolean(gearId),
    staleTime: 1000 * 60,
  });
}

export function useImportStravaGear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importStravaGear,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gear.all });
    },
  });
}

type GearAction =
  | { kind: "create"; input: GearInput }
  | { kind: "update"; gearId: string; input: Partial<GearInput> }
  | { kind: "retire"; gearId: string }
  | { kind: "restore"; gearId: string }
  | { kind: "delete"; gearId: string };

export function useGearMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: GearAction) => {
      switch (action.kind) {
        case "create":
          return createGear(action.input);
        case "update":
          return updateGear(action.gearId, action.input);
        case "retire":
          return retireGear(action.gearId);
        case "restore":
          return restoreGear(action.gearId);
        case "delete":
          await deleteGear(action.gearId);
          return null;
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.gear.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all });
    },
  });
}
