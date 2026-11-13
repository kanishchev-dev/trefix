"use client";

import type { ReactElement, ReactNode } from "react";

import { Input } from "@trefix/ui/components/input";

import type { ActivityFilter } from "@/entities/activity/api";
import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";

import { ACTIVITY_ACTOR_TYPES, ACTIVITY_DOMAINS } from "../lib/activity-texts";

export type ActivityPeriod = "7d" | "30d" | "90d" | "all";

const PERIODS: readonly ActivityPeriod[] = ["7d", "30d", "90d", "all"];
const PERIOD_DAYS: Record<ActivityPeriod, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

export type ActivityFilterState = {
  domain: string;
  actorType: string;
  period: ActivityPeriod;
  q: string;
};

export const DEFAULT_ACTIVITY_FILTER: ActivityFilterState = {
  domain: "all",
  actorType: "all",
  period: "30d",
  q: "",
};

/** Request filter of the form state; the period is counted back from now. */
export function toActivityFilter(state: ActivityFilterState): ActivityFilter {
  const days = PERIOD_DAYS[state.period];
  return {
    domain: state.domain === "all" ? undefined : [state.domain],
    actorType: state.actorType === "all" ? undefined : [state.actorType],
    from: days
      ? new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
    q: state.q.trim() || undefined,
  };
}

export function ActivityFilters({
  value,
  onChange,
  children,
}: {
  value: ActivityFilterState;
  onChange: (value: ActivityFilterState) => void;
  /** Extra controls placed before the shared ones. */
  children?: ReactNode;
}): ReactElement {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      <div className="w-44">
        <OptionSelect
          value={value.domain}
          options={[
            { value: "all", label: t("activity.filters.allDomains") },
            ...ACTIVITY_DOMAINS.map((domain) => ({
              value: domain,
              label: t(`activity.domains.${domain}`),
            })),
          ]}
          onValueChange={(domain) => onChange({ ...value, domain })}
        />
      </div>
      <div className="w-44">
        <OptionSelect
          value={value.actorType}
          options={[
            { value: "all", label: t("activity.filters.allActors") },
            ...ACTIVITY_ACTOR_TYPES.map((actor) => ({
              value: actor,
              label: t(`activity.actors.${actor}`),
            })),
          ]}
          onValueChange={(actorType) => onChange({ ...value, actorType })}
        />
      </div>
      <div className="w-40">
        <OptionSelect
          value={value.period}
          options={PERIODS.map((period) => ({
            value: period,
            label: t(`activity.periods.${period}`),
          }))}
          onValueChange={(period) => onChange({ ...value, period })}
        />
      </div>
      <Input
        className="w-56"
        value={value.q}
        placeholder={t("activity.filters.search")}
        onChange={(event) => onChange({ ...value, q: event.target.value })}
      />
    </div>
  );
}
