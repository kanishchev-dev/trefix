import { useEffect, useRef } from "react";
import { useRealtime } from "./realtime-provider";
import { type RealtimeEventHandler, type RealtimeEventMeta } from "./types";

/**
 * Custom React hook to subscribe to any Realtime WebSocket event from the backend.
 * Automatically manages subscription lifecycle and cleans up on component unmount.
 *
 * @example
 * useRealtimeEvent("coach.message_received", (message) => {
 *   console.log("New coach message:", message);
 * });
 */
export function useRealtimeEvent<T = unknown>(
  event: string,
  handler: (data: T, meta?: RealtimeEventMeta) => void,
): void {
  const { client } = useRealtime();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!client || !event) {
      return;
    }

    const eventListener: RealtimeEventHandler = (data, meta) => {
      if (handlerRef.current) {
        handlerRef.current(data as T, meta);
      }
    };

    const unsubscribe = client.on(event, eventListener);

    return () => {
      unsubscribe();
    };
  }, [client, event]);
}
