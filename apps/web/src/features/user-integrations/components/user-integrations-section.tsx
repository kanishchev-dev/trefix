"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import { ButtonGroup } from "@trefix/ui/components/button-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trefix/ui/components/dropdown-menu";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@trefix/ui/components/item";
import { Spinner } from "@trefix/ui/components/spinner";
import {
  ActivityIcon,
  ChevronDownIcon,
  HeartPulseIcon,
  PlugIcon,
  RefreshCwIcon,
  UnplugIcon,
  UserRoundIcon,
  WatchIcon,
  type LucideIcon,
} from "lucide-react";

import type { IntegrationsList } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import {
  disconnectUserIntegration,
  fetchUserIntegrations,
  requestUserDeviceSync,
  syncUserStrava,
  syncUserStravaProfile,
} from "@/entities/user-integrations/api";
import { NoAthlete } from "@/features/users/components/card/no-athlete";
import {
  userCardKeys,
  useUserCardMutation,
} from "@/features/users/hooks/use-user-card-query";
import { isNotFound } from "@/features/users/lib/card-errors";
import { formatDate, useI18n } from "@/shared/i18n";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { DetailSkeleton, ErrorState } from "@/widgets/data-state";

type Integration = IntegrationsList["items"][number];

const SECTION = "integrations";
const DEVICE_PROVIDERS = new Set(["apple_health", "health_connect"]);
const PROBLEM_STATUSES = new Set(["error", "reauthorization_required"]);

function useIntegrationActions(userId: string) {
  const { t } = useI18n();
  return {
    syncStrava: useUserCardMutation(userId, {
      mutationFn: () => syncUserStrava(userId),
      sections: [SECTION],
      successMessage: t("userCard.integrations.toasts.syncStarted"),
    }),
    syncStravaProfile: useUserCardMutation(userId, {
      mutationFn: () => syncUserStravaProfile(userId),
      sections: [SECTION, "athlete"],
      successMessage: t("userCard.integrations.toasts.profileSynced"),
    }),
    requestDeviceSync: useUserCardMutation(userId, {
      mutationFn: (provider: string) => requestUserDeviceSync(userId, provider),
      sections: [SECTION],
      successMessage: (delivered: boolean) =>
        delivered
          ? t("userCard.integrations.toasts.syncRequested")
          : t("userCard.integrations.toasts.deviceOffline"),
    }),
    disconnect: useUserCardMutation(userId, {
      mutationFn: (provider: string) =>
        disconnectUserIntegration(userId, provider),
      sections: [SECTION],
      successMessage: t("userCard.integrations.toasts.disconnected"),
    }),
  };
}

const PROVIDER_ICONS: Record<string, LucideIcon> = {
  strava: ActivityIcon,
  garmin: WatchIcon,
  apple_health: HeartPulseIcon,
  health_connect: HeartPulseIcon,
};

function IntegrationItem({
  userId,
  item,
  canManage,
  onDisconnect,
}: {
  userId: string;
  item: Integration;
  canManage: boolean;
  onDisconnect: (provider: string) => void;
}): ReactElement {
  const { t, locale } = useI18n();
  const actions = useIntegrationActions(userId);
  const connected = item.status !== "disconnected";
  const isDevice = DEVICE_PROVIDERS.has(item.provider);
  const isStrava = item.provider === "strava";
  const Icon = PROVIDER_ICONS[item.provider] ?? PlugIcon;
  const details = connected
    ? [
        t("userCard.integrations.connectedAt", {
          date: formatDate(item.connectedAt, locale),
        }),
        `${t("userCard.integrations.lastSync")}: ${formatDate(item.lastSyncedAt, locale)}`,
        `${t("userCard.integrations.imported")}: ${item.importedActivitiesCount ?? 0}`,
      ]
    : [
        item.available === false
          ? t("userCard.integrations.unavailable")
          : t("userCard.integrations.notConnected"),
      ];
  const extra = [
    item.externalUserId
      ? `${t("userCard.integrations.externalId")}: ${item.externalUserId}`
      : null,
    item.pendingBatches
      ? `${t("userCard.integrations.pending")}: ${item.pendingBatches}`
      : null,
    isStrava && connected
      ? `${t("userCard.integrations.profileSync")}: ${
          item.profileSync
            ? formatDate(item.lastProfileSyncAt, locale)
            : t("userCard.integrations.off")
        }`
      : null,
    item.scopes?.length
      ? `${t("userCard.integrations.scopes")}: ${item.scopes.join(", ")}`
      : null,
  ].filter(Boolean);
  const syncAction = isStrava
    ? {
        label: t("userCard.integrations.actions.sync"),
        pending: actions.syncStrava.isPending,
        run: () => actions.syncStrava.mutate(undefined),
      }
    : isDevice
      ? {
          label: t("userCard.integrations.actions.requestSync"),
          pending: actions.requestDeviceSync.isPending,
          run: () => actions.requestDeviceSync.mutate(item.provider),
        }
      : null;

  return (
    <Item variant="outline" className={connected ? undefined : "opacity-70"}>
      <ItemMedia
        variant="icon"
        className="size-10 rounded-xl border bg-muted/50"
      >
        <Icon />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>
          {t(`userCard.providers.${item.provider}`)}
          <Badge
            variant={
              PROBLEM_STATUSES.has(item.status)
                ? "destructive"
                : connected
                  ? "outline"
                  : "secondary"
            }
          >
            {t(`userCard.connectionStatuses.${item.status}`)}
          </Badge>
        </ItemTitle>
        <ItemDescription>{details.join(" · ")}</ItemDescription>
      </ItemContent>
      {canManage && connected ? (
        <ItemActions>
          <ButtonGroup>
            {syncAction ? (
              <Button
                variant="outline"
                size="sm"
                disabled={syncAction.pending}
                onClick={syncAction.run}
              >
                {syncAction.pending ? <Spinner /> : <RefreshCwIcon />}
                {syncAction.label}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t("userCard.actions.more")}
                  />
                }
              >
                <ChevronDownIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-52">
                {isStrava && item.profileAccess ? (
                  <DropdownMenuItem
                    disabled={actions.syncStravaProfile.isPending}
                    onClick={() => actions.syncStravaProfile.mutate(undefined)}
                  >
                    <UserRoundIcon />
                    {t("userCard.integrations.actions.profileSync")}
                  </DropdownMenuItem>
                ) : null}
                {isStrava && item.profileAccess ? (
                  <DropdownMenuSeparator />
                ) : null}
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDisconnect(item.provider)}
                >
                  <UnplugIcon />
                  {t("userCard.integrations.actions.disconnect")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </ButtonGroup>
        </ItemActions>
      ) : null}
      {connected && extra.length > 0 ? (
        <ItemFooter className="basis-full justify-start pl-14 text-xs text-muted-foreground">
          <span className="break-all">{extra.join(" · ")}</span>
        </ItemFooter>
      ) : null}
    </Item>
  );
}

export function UserIntegrationsSection({
  userId,
}: {
  userId: string;
}): ReactElement {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const query = useQuery({
    queryKey: userCardKeys.section(userId, SECTION),
    queryFn: () => fetchUserIntegrations(userId),
    retry: false,
  });
  const { disconnect } = useIntegrationActions(userId);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const canManage = hasPermission("integrations.users.manage");

  if (query.isLoading) return <DetailSkeleton />;
  if (isNotFound(query.error)) return <NoAthlete />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <ItemGroup className="gap-3">
        {query.data.items.map((item) => (
          <IntegrationItem
            key={item.provider}
            userId={userId}
            item={item}
            canManage={canManage}
            onDisconnect={setDisconnecting}
          />
        ))}
      </ItemGroup>
      <ConfirmDialog
        open={disconnecting !== null}
        onOpenChange={(open) => !open && setDisconnecting(null)}
        title={t("userCard.integrations.disconnectTitle")}
        description={t("userCard.integrations.disconnectDescription", {
          provider: disconnecting
            ? t(`userCard.providers.${disconnecting}`)
            : "",
        })}
        confirmLabel={t("userCard.integrations.actions.disconnect")}
        isPending={disconnect.isPending}
        onConfirm={() =>
          disconnecting &&
          disconnect.mutate(disconnecting, {
            onSuccess: () => setDisconnecting(null),
          })
        }
      />
    </div>
  );
}
