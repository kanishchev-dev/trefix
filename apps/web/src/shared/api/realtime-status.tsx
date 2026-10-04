"use client";

import { useSyncExternalStore, type ReactElement } from "react";

import {
  DropdownMenuGroup,
  DropdownMenuLabel,
} from "@workspace/ui/components/dropdown-menu";
import { Separator } from "@workspace/ui/components/separator";

import { useI18n } from "@/shared/i18n";
import { useRealtimeClient } from "@/shared/api/realtime-provider";
import {
  REALTIME_STATUS_META,
  type RealtimeConnectionStatus,
} from "@/shared/api/realtime-events";

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
 * Realtime connection indicator.
 *
 * Without it a broken socket is invisible: the UI simply stops reflecting other
 * people's changes, which looks like a bug somewhere else.
 */
export function RealtimeStatusIndicator(): ReactElement {
  const { t } = useI18n();
  const status = useRealtimeStatus();
  const meta = REALTIME_STATUS_META[status];

  return (
    <>
      <Separator className="my-1" />
      <DropdownMenuGroup>
        <DropdownMenuLabel className="flex items-center gap-2 font-normal">
          <span
            aria-hidden="true"
            className={`size-2 shrink-0 rounded-full ${meta.dotClassName}`}
          />
          <span className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              {t("realtime.label")}
            </span>
            <span className="text-sm">{t(meta.labelKey)}</span>
          </span>
        </DropdownMenuLabel>
      </DropdownMenuGroup>
    </>
  );
}