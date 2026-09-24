import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  disconnectStrava,
  getIntegrations,
  getStravaIntegration,
  getStravaSyncStatus,
  initiateStravaConnect,
  triggerStravaSync,
} from "../../../lib/integrations-api";

export function useIntegrations() {
  return useQuery({
    queryKey: ["integrations"],
    queryFn: getIntegrations,
  });
}

export function useStravaIntegration() {
  return useQuery({
    queryKey: ["integrations", "strava"],
    queryFn: getStravaIntegration,
  });
}

export function useStravaSyncStatus(enabled = true) {
  return useQuery({
    queryKey: ["integrations", "strava", "sync"],
    queryFn: getStravaSyncStatus,
    enabled,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && (data.status === "syncing" || data.status === "in_progress")) {
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
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });
}

export function useTriggerStravaSync() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: triggerStravaSync,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", "strava", "sync"] });
    },
  });
}
