"use client";

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
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@trefix/ui/components/item";
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  MessageCircleIcon,
  SendIcon,
  SmartphoneIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  displayNameOf,
  useUserCard,
} from "@/features/users/context/user-card-context";
import { formatDate, useI18n } from "@/shared/i18n";
import { DetailSkeleton, EmptyState, ErrorState } from "@/widgets/data-state";

import {
  useUserNotifications,
  useUserPushDevices,
} from "../hooks/use-notifications";
import {
  linkLabel,
  notificationBody,
  notificationTitle,
} from "../lib/notification-texts";
import { ComposeBroadcastDialog } from "./compose-broadcast-dialog";
import { DeliveryBadges } from "./delivery-badges";

function Devices({ userId }: { userId: string }): ReactElement {
  const { t, locale } = useI18n();
  const query = useUserPushDevices(userId);
  const devices = query.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("notifications.user.devicesTitle")}</CardTitle>
        <CardDescription>
          {t("notifications.user.devicesDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <DetailSkeleton />
        ) : query.isError ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("notifications.user.noDevices")}
          </p>
        ) : (
          <ItemGroup className="gap-1">
            {devices.map((device) => (
              <Item key={device.id} size="sm">
                <ItemMedia variant="icon">
                  <SmartphoneIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {device.deviceName ??
                      t(`notifications.user.platforms.${device.platform}`)}
                  </ItemTitle>
                  <ItemDescription>
                    {t("notifications.user.lastSeen", {
                      date: formatDate(device.lastSeenAt, locale),
                    })}
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <Badge variant="outline">
                    {t(`notifications.user.platforms.${device.platform}`)}
                  </Badge>
                  {device.appVersion ? (
                    <Badge variant="outline">{device.appVersion}</Badge>
                  ) : null}
                  {device.locale ? (
                    <Badge variant="outline">{device.locale}</Badge>
                  ) : null}
                </ItemActions>
              </Item>
            ))}
          </ItemGroup>
        )}
      </CardContent>
    </Card>
  );
}

/** Notifications of a user with delivery per channel, their push devices, and sending one. */
export function UserNotificationsSection({
  userId,
}: {
  userId: string;
}): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const user = useUserCard();
  const canSend = hasPermission("notifications.broadcasts.send");
  const [page, setPage] = useState(1);
  const [composeOpen, setComposeOpen] = useState(false);
  const query = useUserNotifications(userId, page);
  const items = query.data?.data ?? [];
  const meta = query.data?.meta;
  const name = displayNameOf(user);
  const canReceive = user.status === "active";

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("notifications.user.inboxTitle")}</CardTitle>
          <CardDescription>
            {t("notifications.user.inboxDescription")}
          </CardDescription>
          {canSend && canReceive ? (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setComposeOpen(true)}
              >
                <SendIcon />
                {t("notifications.user.send")}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {query.isLoading ? (
            <DetailSkeleton />
          ) : query.isError ? (
            <ErrorState onRetry={() => query.refetch()} />
          ) : items.length === 0 ? (
            <EmptyState
              title={t("notifications.user.empty.title")}
              description={t("notifications.user.empty.description")}
            />
          ) : (
            <ItemGroup className="gap-1">
              {items.map((item) => (
                <Item
                  key={item.id}
                  variant={item.readAt ? "default" : "muted"}
                  className="items-start"
                >
                  <ItemMedia variant="icon">
                    {item.category === "coach" ? (
                      <MessageCircleIcon />
                    ) : (
                      <BellIcon />
                    )}
                  </ItemMedia>
                  <ItemContent className="gap-1">
                    <ItemTitle>{notificationTitle(item, t)}</ItemTitle>
                    <ItemDescription className="line-clamp-3 whitespace-pre-wrap">
                      {notificationBody(item, t)}
                    </ItemDescription>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="whitespace-nowrap">
                        {formatDate(item.createdAt, locale)}
                      </span>
                      <span className="whitespace-nowrap">
                        {item.readAt
                          ? t("notifications.user.read", {
                              date: formatDate(item.readAt, locale),
                            })
                          : t("notifications.user.unread")}
                      </span>
                      {item.link ? (
                        <span className="whitespace-nowrap">
                          {linkLabel(item.link, t)}
                        </span>
                      ) : null}
                    </div>
                  </ItemContent>
                  <ItemActions>
                    <DeliveryBadges deliveries={item.deliveries} />
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
          {meta && meta.totalPages > 1 ? (
            <div className="flex items-center justify-end gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!meta.hasPreviousPage}
                onClick={() => setPage((value) => value - 1)}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("common.pagination.page", {
                  page: meta.page,
                  totalPages: Math.max(meta.totalPages, 1),
                })}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!meta.hasNextPage}
                onClick={() => setPage((value) => value + 1)}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Devices userId={userId} />

      <ComposeBroadcastDialog
        open={composeOpen}
        onOpenChange={setComposeOpen}
        user={{ id: userId, name }}
      />
    </div>
  );
}
