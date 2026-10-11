"use client";

import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
  type ReactNode,
} from "react";

import { useAuth } from "@/components/auth-provider";
import { RealtimeClient } from "@/shared/api/realtime-client";
import { applyRealtimeEventToCache } from "@/shared/api/realtime-sync";
import {
  REALTIME_EVENT_CACHE_KEYS,
  REALTIME_SELF_EVENTS,
  realtimeEventUserId,
  realtimeRoomsForPermissions,
} from "@/shared/api/realtime-events";

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
  const { isAuthenticated, hasPermission, user, refreshAuth } = useAuth();

  const client = useMemo(() => new RealtimeClient(), []);
  const currentUserId = user?.id;

  // `refreshAuth` is a fresh closure on every render; the ref lets the listener
  // below stay subscribed to the client instead of tearing itself down and
  // rebuilding on each one.
  const refreshAuthRef = useRef(refreshAuth);
  useEffect(() => {
    refreshAuthRef.current = refreshAuth;
  }, [refreshAuth]);

  // `hasPermission` is a fresh closure on every render, so the rooms are
  // reduced to a string key: that keeps the effect below from re-subscribing on
  // every single render while still reacting to a real permission change.
  const rooms = realtimeRoomsForPermissions(hasPermission).join(",");

  // Subscriptions are registered once; the connection itself is (re)opened
  // whenever the session becomes available, because the socket token is
  // fetched from the httpOnly session cookie.
  useEffect(() => {
    const unsubscribers = Object.entries(REALTIME_EVENT_CACHE_KEYS).map(
      ([event, keys]) =>
        client.on(event, (payload) => {
          // Merge first so the change is on screen immediately, then refetch in
          // the background: the event carries only the fields it changed, so the
          // request stays the source of truth for everything else.
          applyRealtimeEventToCache(queryClient, event, payload);

          keys.forEach((key) => {
            void queryClient.invalidateQueries({ queryKey: key });
          });
        }),
    );

    if (isAuthenticated) {
      void client.connect(rooms.length > 0 ? rooms.split(",") : []);
    }

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      client.disconnect();
    };
  }, [client, queryClient, isAuthenticated, rooms]);

  // A background tab keeps its socket, but the browser may have suspended the
  // traffic long enough for events to be missed. Reconnecting on the way back is
  // cheap and makes the connection self-healing instead of one-shot.
  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    const roomList = rooms.length > 0 ? rooms.split(",") : [];

    const onVisibilityChange = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      void client.connect(roomList);
      // Whatever realtime marked stale while the tab was hidden is still stale:
      // the browser may never have run those refetches.
      void queryClient.invalidateQueries();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [client, isAuthenticated, queryClient, rooms]);

  // The signed-in user lives in the auth context rather than in react-query, so
  // a cache invalidation cannot reach the sidebar name, the avatar or the
  // permission gates. Events about the viewer refresh the session instead.
  useEffect(() => {
    if (!currentUserId) {
      return;
    }

    const unsubscribers = REALTIME_SELF_EVENTS.map((event) =>
      client.on(event, (payload) => {
        if (realtimeEventUserId(payload) === currentUserId) {
          void refreshAuthRef.current();
        }
      }),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [client, currentUserId]);

  const value = useMemo<RealtimeContextValue>(() => ({ client }), [client]);

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeClient(): RealtimeClient | null {
  return useContext(RealtimeContext).client;
}
