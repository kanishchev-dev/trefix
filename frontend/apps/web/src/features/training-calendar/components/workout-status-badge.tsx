"use client";

import type { ComponentProps, ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";

import type { WorkoutStatus } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";

const STATUS_VARIANTS: Record<
  WorkoutStatus,
  ComponentProps<typeof Badge>["variant"]
> = {
  planned: "outline",
  completed: "default",
  skipped: "secondary",
  cancelled: "destructive",
};

export function WorkoutStatusBadge({
  status,
}: {
  status: WorkoutStatus;
}): ReactElement {
  const { t } = useI18n();

  return (
    <Badge variant={STATUS_VARIANTS[status]}>
      {t(`trainingCalendar.statuses.${status}`)}
    </Badge>
  );
}
