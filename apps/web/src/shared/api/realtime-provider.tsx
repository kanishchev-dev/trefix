"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactElement,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/auth-provider";
import { RealtimeClient } from "@/shared/api/realtime-client";

/**
 * Backend event -> React Query cache keys that must be refreshed.
 * Keeps the admin UI in sync with changes made by other sessions
 * (or by the backend control plane) without a manual page reload.
 */
const CACHE_INVALIDATION_MAP: Record<string, string[][]> = {
  "user.created": [["users"]],
  "user.updated": [["users"]],
  "user.deleted": [["users"]],
  "user-permissions.updated": [["users"], ["permissions"], ["permission-groups"]],
  "permission.created": [["permissions"], ["permission-groups"]],
  "permission.updated": [["permissions"], ["permission-groups"]],
  "permission.deleted": [["permissions"], ["permission-groups"]],
  "permission-group.created": [["permissions"], ["permission-groups"], ["settings"]],
  "permission-group.updated": [["permissions"], ["permission-groups"], ["settings"]],
  "permission-group.deleted": [["permissions"], ["permission-groups"], ["settings"]],
};

type RealtimeContextValue = {
  client: RealtimeClient | null;
};

const RealtimeContext = createContext<RealtimeContextValue>({ client: null });

export function RealtimeProvider({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const client = useMemo(() => new RealtimeClient(), []);

  // Subscriptions are registered once; the connection itself is (re)opened
  // whenever the session becomes available, because the socket token is
  // fetched from the httpOnly session cookie.
  useEffect(() => {
    const unsubscribers = Object.entries(CACHE_INVALIDATION_MAP).map(
      ([event, keys]) =>
        client.on(event, () => {
          keys.forEach((key) => {
            void queryClient.invalidateQueries({ queryKey: key });
          });
        }),
    );

    if (isAuthenticated) {
      void client.connect();
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      client.disconnect();
    };
  }, [client, queryClient, isAuthenticated]);

  const value = useMemo<RealtimeContextValue>(() => ({ client }), [client]);

  return (
    <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>
  );
}

export function useRealtimeClient(): RealtimeClient | null {
  return useContext(RealtimeContext).client;
}