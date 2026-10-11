import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectStrava,
  getIntegrations,
  getStravaIntegration,
  getStravaSyncStatus,
  initiateStravaConnect,
  triggerStravaSync,
} from "../../../lib/integrations-api";
import { queryKeys } from "../../../shared/lib/query-keys";

export function useIntegrations() {
  return useQuery({
    queryKey: queryKeys.integrations.all,
    queryFn: getIntegrations,
  });
}

export function useStravaIntegration() {
  return useQuery({
    queryKey: queryKeys.integrations.strava(),
    queryFn: getStravaIntegration,
  });
}

export function useStravaSyncStatus(enabled = true) {
  return useQuery({
    queryKey: queryKeys.integrations.sync("strava"),
    queryFn: getStravaSyncStatus,
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (
        data &&
        (data.status === "syncing" || data.status === "in_progress")
      ) {
        return 2000; // poll every 2 seconds while syncing
      }
      return false;
    },
  });
}

export function useConnectStrava() {
  return useMutation({
    mutationFn: initiateStravaConnect,
  });
}

export function useDisconnectStrava() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: disconnectStrava,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.integrations.all });
    },
  });
}

export function useTriggerStravaSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerStravaSync,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.integrations.sync("strava"),
      });
    },
  });
}
