"use client";

import type { ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";

import type {
  AdminNotification,
  BroadcastStatus,
  NotificationDeliveryStatus,
} from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";

type Delivery = AdminNotification["deliveries"][number];

const DELIVERY_VARIANT: Record<
  NotificationDeliveryStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  delivered: "default",
  sent: "secondary",
  pending: "outline",
  skipped: "outline",
  failed: "destructive",
};

const BROADCAST_VARIANT: Record<
  BroadcastStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  sent: "secondary",
  queued: "outline",
  sending: "outline",
  failed: "destructive",
};

/** One badge per channel: status and, for a skipped or failed delivery, the reason. */
export function DeliveryBadges({
  deliveries,
}: {
  deliveries: readonly Delivery[];
}): ReactElement {
  const { t } = useI18n();

  if (deliveries.length === 0) {
    return (
      <span className="text-xs whitespace-nowrap text-muted-foreground">
        {t("notifications.delivery.inboxOnly")}
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {deliveries.map((delivery) => (
        <Badge
          key={delivery.channel}
          variant={DELIVERY_VARIANT[delivery.status]}
          className="whitespace-nowrap"
        >
          {t(`notifications.delivery.channels.${delivery.channel}`)} ·{" "}
          {t(`notifications.delivery.statuses.${delivery.status}`)}
          {delivery.error
            ? `, ${t(`notifications.delivery.errors.${delivery.error}`)}`
            : ""}
        </Badge>
      ))}
    </div>
  );
}

export function BroadcastStatusBadge({
  status,
}: {
  status: BroadcastStatus;
}): ReactElement {
  const { t } = useI18n();
  return (
    <Badge variant={BROADCAST_VARIANT[status]} className="whitespace-nowrap">
      {t(`notifications.statuses.${status}`)}
    </Badge>
  );
}
