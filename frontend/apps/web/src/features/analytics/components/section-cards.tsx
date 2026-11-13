"use client";

import type { ReactElement, ReactNode } from "react";

import type { AnalyticsKpi, AnalyticsSummary } from "@trefix/api-client";
import { Badge } from "@trefix/ui/components/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import { Skeleton } from "@trefix/ui/components/skeleton";
import { MinusIcon, TrendingDownIcon, TrendingUpIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";

import { useI18n } from "@/shared/i18n";

import {
  formatCompact,
  formatNumber,
  formatPercent,
  formatSigned,
  trendOf,
} from "../lib/format";
import {
  adherenceInsight,
  runnersInsight,
  type Insight,
} from "../lib/insights";

const TREND_ICONS = {
  up: TrendingUpIcon,
  down: TrendingDownIcon,
  flat: MinusIcon,
} as const;

/** Change against the previous period; direction is shown by the icon, not by colour. */
export function TrendBadge({
  deltaPct,
}: {
  deltaPct: number | null;
}): ReactElement | null {
  const { locale } = useI18n();
  if (deltaPct === null) return null;
  const Icon = TREND_ICONS[trendOf(deltaPct)];
  return (
    <Badge variant="outline" className="tabular-nums">
      <Icon />
      {formatSigned(deltaPct, locale, "%")}
    </Badge>
  );
}

function Sparkline({
  values,
}: {
  values: readonly number[];
}): ReactElement | null {
  if (values.length < 2) return null;
  const data = values.map((value, index) => ({ index, value }));
  return (
    <div className="h-9 w-full" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 2, bottom: 2, left: 0, right: 0 }}
        >
          <Area
            dataKey="value"
            type="monotone"
            stroke="var(--muted-foreground)"
            strokeWidth={1.5}
            fill="var(--muted-foreground)"
            fillOpacity={0.08}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({
  title,
  kpi,
  value,
  conclusion,
  caption,
}: {
  title: string;
  kpi: AnalyticsKpi;
  value: ReactNode;
  conclusion: ReactNode;
  caption: string;
}): ReactElement {
  const Icon = TREND_ICONS[trendOf(kpi.deltaPct)];
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription className="truncate">{title}</CardDescription>
        <CardTitle className="text-2xl font-medium whitespace-nowrap tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          <TrendBadge deltaPct={kpi.deltaPct} />
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <Sparkline values={kpi.spark} />
      </CardContent>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="flex w-full min-w-0 items-center gap-2 font-medium">
          <span className="truncate">{conclusion}</span>
          <Icon className="size-4 shrink-0" />
        </div>
        <div className="w-full truncate text-muted-foreground">{caption}</div>
      </CardFooter>
    </Card>
  );
}

function KpiSkeleton(): ReactElement {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-8 w-24" />
      </CardHeader>
      <CardFooter className="flex-col items-start gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-4 w-48" />
      </CardFooter>
    </Card>
  );
}

const GRID =
  "grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card";

/** KPI cards at the top of the dashboard (dashboard-01 section cards). */
export function SectionCards({
  summary,
  loading,
}: {
  summary: AnalyticsSummary | undefined;
  loading: boolean;
}): ReactElement {
  const { t, locale } = useI18n();
  if (!summary || loading) {
    return (
      <div className={GRID}>
        {Array.from({ length: 8 }, (_, index) => (
          <KpiSkeleton key={index} />
        ))}
      </div>
    );
  }
  const insight = (value: Insight): string =>
    t(`analytics.insights.${value.key}`, value.params);
  const s = summary;
  return (
    <div className={GRID}>
      <KpiCard
        title={t("analytics.kpi.runners")}
        kpi={s.weeklyActiveRunners}
        value={formatNumber(s.weeklyActiveRunners.value, locale)}
        conclusion={insight(runnersInsight(s.weeklyActiveRunners))}
        caption={t("analytics.kpi.runnersCaption")}
      />
      <KpiCard
        title={t("analytics.kpi.adherence")}
        kpi={s.planAdherence}
        value={formatPercent(s.planAdherence.value, locale)}
        conclusion={insight(adherenceInsight(s.planAdherence))}
        caption={t("analytics.kpi.adherenceCaption")}
      />
      <KpiCard
        title={t("analytics.kpi.goals")}
        kpi={s.goalsAchieved}
        value={formatNumber(s.goalsAchieved.value, locale)}
        conclusion={t("analytics.kpi.goalsRate", {
          value: formatPercent(s.goalsAchieved.rate, locale),
        })}
        caption={t("analytics.kpi.goalsCaption")}
      />
      <KpiCard
        title={t("analytics.kpi.newUsers")}
        kpi={s.newUsers}
        value={formatNumber(s.newUsers.value, locale)}
        conclusion={t("analytics.kpi.activation", {
          value: formatPercent(s.newUsers.activationRate, locale),
        })}
        caption={t("analytics.kpi.newUsersCaption")}
      />
      <KpiCard
        title={t("analytics.kpi.stickiness")}
        kpi={s.stickiness}
        value={formatPercent(s.stickiness.value, locale)}
        conclusion={t("analytics.kpi.dauMau", {
          dau: formatNumber(s.stickiness.dau, locale),
          mau: formatNumber(s.stickiness.mau, locale),
        })}
        caption={t("analytics.kpi.stickinessCaption")}
      />
      <KpiCard
        title={t("analytics.kpi.records")}
        kpi={s.personalRecords}
        value={formatNumber(s.personalRecords.value, locale)}
        conclusion={t("analytics.kpi.firsts", {
          value: formatNumber(s.personalRecords.firsts, locale),
        })}
        caption={t("analytics.kpi.recordsCaption")}
      />
      <KpiCard
        title={t("analytics.kpi.distance")}
        kpi={s.distanceKm}
        value={formatCompact(s.distanceKm.value, locale)}
        conclusion={t("analytics.kpi.weeklyMedian", {
          value: formatNumber(s.distanceKm.weeklyMedianKm, locale),
        })}
        caption={t("analytics.kpi.distanceCaption")}
      />
      <KpiCard
        title={t("analytics.kpi.coach")}
        kpi={s.coachActiveUsers}
        value={formatNumber(s.coachActiveUsers.value, locale)}
        conclusion={t("analytics.kpi.proactiveReplies", {
          value: formatPercent(s.coachActiveUsers.proactiveReplyRate, locale),
        })}
        caption={t("analytics.kpi.coachCaption")}
      />
    </div>
  );
}
