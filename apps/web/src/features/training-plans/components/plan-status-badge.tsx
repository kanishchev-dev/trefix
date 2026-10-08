"use client";

import type { ReactElement } from "react";

import { Badge } from "@workspace/ui/components/badge";

import type { PlanLifecycleStatus } from "@workspace/api-client";

import { useI18n } from "@/shared/i18n";

import { PLAN_STATUS_VARIANTS } from "../lib/plan-format";

export function PlanStatusBadge({
  status,
}: {
  status: PlanLifecycleStatus;
}): ReactElement {
  const { t } = useI18n();

  return (
    <Badge variant={PLAN_STATUS_VARIANTS[status]}>
      {t(`userPlans.status.${status}`)}
    </Badge>
  );
}
