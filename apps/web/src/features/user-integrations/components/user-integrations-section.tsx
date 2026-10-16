"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, type ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import { RefreshCwIcon, UnplugIcon, UserRoundIcon } from "lucide-react";

import type { IntegrationsList } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import {
  disconnectUserIntegration,
  fetchUserIntegrations,
  requestUserDeviceSync,
  syncUserStrava,
  syncUserStravaProfile,
} from "@/entities/user-integrations/api";
import { DetailRow } from "@/features/users/components/card/detail-row";
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

function IntegrationCard({
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

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="font-medium">
          {t(`userCard.providers.${item.provider}`)}
        </CardTitle>
        <CardDescription>
          {item.available === false
            ? t("userCard.integrations.unavailable")
            : connected
              ? t("userCard.integrations.connectedAt", {
                  date: formatDate(item.connectedAt, locale),
                })
              : t("userCard.integrations.notConnected")}
        </CardDescription>
        <CardAction>
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
        </CardAction>
      </CardHeader>
      {connected ? (
        <CardContent className="flex flex-col gap-3">
          <div className="grid gap-x-6 sm:grid-cols-2">
            <DetailRow
              label={t("userCard.integrations.lastSync")}
              value={formatDate(item.lastSyncedAt, locale)}
            />
            <DetailRow
              label={t("userCard.integrations.imported")}
              value={item.importedActivitiesCount ?? 0}
            />
            {item.externalUserId ? (
              <DetailRow
                label={t("userCard.integrations.externalId")}
                value={
                  <span className="font-mono text-xs">
                    {item.externalUserId}
                  </span>
                }
              />
            ) : null}
            {item.pendingBatches ? (
              <DetailRow
                label={t("userCard.integrations.pending")}
                value={item.pendingBatches}
              />
            ) : null}
            {isStrava ? (
              <DetailRow
                label={t("userCard.integrations.profileSync")}
                value={
                  item.profileSync
                    ? formatDate(item.lastProfileSyncAt, locale)
                    : t("userCard.integrations.off")
                }
              />
            ) : null}
            {item.scopes?.length ? (
              <DetailRow
                label={t("userCard.integrations.scopes")}
                value={item.scopes.join(", ")}
              />
            ) : null}
          </div>
          {canManage ? (
            <div className="flex flex-wrap gap-2">
              {isStrava ? (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={actions.syncStrava.isPending}
                    onClick={() => actions.syncStrava.mutate(undefined)}
                  >
                    <RefreshCwIcon />
                    {t("userCard.integrations.actions.sync")}
                  </Button>
                  {item.profileAccess ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={actions.syncStravaProfile.isPending}
                      onClick={() =>
                        actions.syncStravaProfile.mutate(undefined)
                      }
                    >
                      <UserRoundIcon />
                      {t("userCard.integrations.actions.profileSync")}
                    </Button>
                  ) : null}
                </>
              ) : null}
              {isDevice ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actions.requestDeviceSync.isPending}
                  onClick={() =>
                    actions.requestDeviceSync.mutate(item.provider)
                  }
                >
                  <RefreshCwIcon />
                  {t("userCard.integrations.actions.requestSync")}
                </Button>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDisconnect(item.provider)}
              >
                <UnplugIcon />
                {t("userCard.integrations.actions.disconnect")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
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
      <div className="grid gap-4 lg:grid-cols-2">
        {query.data.items.map((item) => (
          <IntegrationCard
            key={item.provider}
            userId={userId}
            item={item}
            canManage={canManage}
            onDisconnect={setDisconnecting}
          />
        ))}
      </div>
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
