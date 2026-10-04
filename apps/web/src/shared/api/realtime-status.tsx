"use client";

import { useSyncExternalStore, type ReactElement } from "react";

import { useRealtimeClient } from "@/shared/api/realtime-provider";
import {
  REALTIME_STATUS_META,
  type RealtimeConnectionStatus,
} from "@/shared/api/realtime-events";
import { useI18n } from "@/shared/i18n";

const SERVER_STATUS: RealtimeConnectionStatus = "disconnected";

/**
 * Current socket state.
 *
 * Subscribed through `useSyncExternalStore` rather than state in an effect: the
 * client already exposes a subscribe/getSnapshot pair, and the server snapshot
 * keeps the first client render identical to the server one. Anything else here
 * would report "disconnected" on the server and "connected" on hydration, which
 * React treats as a mismatch.
 */
function useRealtimeStatus(): RealtimeConnectionStatus {
  const client = useRealtimeClient();

  return useSyncExternalStore(
    (onStoreChange) =>
      client ? client.onStatusChange(() => onStoreChange()) : () => undefined,
    () => client?.getStatus() ?? SERVER_STATUS,
    () => SERVER_STATUS,
  );
}

/**
 * Realtime connection indicator, anchored to a corner of an avatar.
 *
 * Sits on the avatar rather than in the user menu because a broken socket is
 * otherwise invisible: the UI simply stops reflecting other people's changes,
 * which looks like a bug somewhere else. The label carries the wording, so the
 * dot alone never has to be guessed at.
 *
 * Rendered as a sibling of the avatar, not a child: the avatar clips its
 * content to a rounded square.
 */
export function RealtimeAvatarIndicator({
  className = "size-2.5",
}: {
  className?: string;
}): ReactElement | null {
  const { t } = useI18n();
  const status = useRealtimeStatus();
  const client = useRealtimeClient();

  if (!client) {
    return null;
  }

  const meta = REALTIME_STATUS_META[status];

  return (
    <span
      role="img"
      aria-label={`${t("realtime.label")}: ${t(meta.labelKey)}`}
      title={`${t("realtime.label")}: ${t(meta.labelKey)}`}
      className={`absolute right-0 bottom-0 block rounded-full ring-2 ring-background ${meta.dotClassName} ${className}`}
    />
  );
}