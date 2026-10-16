"use client";

import type { ReactElement } from "react";

import { useI18n } from "@/shared/i18n";
import { EmptyState } from "@/widgets/data-state";

export function NoAthlete(): ReactElement {
  const { t } = useI18n();
  return (
    <EmptyState
      title={t("userCard.noAthlete.title")}
      description={t("trainingCalendar.noAthleteProfile")}
    />
  );
}
