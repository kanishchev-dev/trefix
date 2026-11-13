"use client";

import type { ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";

import type { UserStatus } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";

export function UserStatusBadge({
  status,
  showActive = false,
}: {
  status: UserStatus;
  showActive?: boolean;
}): ReactElement | null {
  const { t } = useI18n();

  if (status === "active") {
    return showActive ? (
      <Badge variant="outline">{t("userCard.status.active")}</Badge>
    ) : null;
  }

  return (
    <Badge variant={status === "blocked" ? "destructive" : "secondary"}>
      {t(`userCard.status.${status}`)}
    </Badge>
  );
}
