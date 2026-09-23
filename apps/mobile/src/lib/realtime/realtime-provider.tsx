import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { RealtimeClient } from "./realtime-client";
import {
  type RealtimeConnectionStatus,
  type RealtimeErrorPayload,
} from "./types";

interface RealtimeContextValue {
  client: RealtimeClient | null;
  status: RealtimeConnectionStatus;
  isConnected: boolean;
  subscribeRooms: (rooms: string[]) => void;
  unsubscribeRooms: (rooms: string[]) => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  client: null,
  status: "disconnected",
  isConnected: false,
  subscribeRooms: () => {},
  unsubscribeRooms: () => {},
});

type RealtimeProviderProps = {
  accessToken: string | null;
  onAuthError?: (error: RealtimeErrorPayload) => void;
  children: React.ReactNode;
};

export function RealtimeProvider({
  accessToken,
  onAuthError,
  children,
}: RealtimeProviderProps) {
  const clientRef = useRef<RealtimeClient | null>(null);
  if (!clientRef.current) {
    clientRef.current = new RealtimeClient();
  }

  const client = clientRef.current;
  const [status, setStatus] = useState<RealtimeConnectionStatus>("disconnected");

  const onAuthErrorRef = useRef(onAuthError);
  onAuthErrorRef.current = onAuthError;

  useEffect(() => {
    const unsubStatus = client.onStatusChange(setStatus);
    const unsubAuthError = client.onAuthError(async (error) => {
      console.log("[RealtimeProvider] WS Auth error received. Attempting silent token refresh...");
      const { refreshAuthTokens } = await import("../auth-api");
      const newTokens = await refreshAuthTokens();
      if (!newTokens) {
        console.warn("[RealtimeProvider] WS Silent refresh failed. Triggering logout...");
        if (onAuthErrorRef.current) {
          onAuthErrorRef.current(error);
        }
      }
    });

    return () => {
      unsubStatus();
      unsubAuthError();
    };
  }, [client]);

  useEffect(() => {
    if (accessToken) {
      client.connect(accessToken);
    } else {
      client.disconnect();
    }

    return () => {
      client.disconnect();
    };
  }, [accessToken, client]);

  const value = useMemo<RealtimeContextValue>(
    () => ({
      client,
      status,
      isConnected: status === "connected",
      subscribeRooms: (rooms) => client.subscribeRooms(rooms),
      unsubscribeRooms: (rooms) => client.unsubscribeRooms(rooms),
    }),
    [client, status],
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}
