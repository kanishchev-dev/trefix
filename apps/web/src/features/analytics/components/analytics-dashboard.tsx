"use client";

import type { ReactElement } from "react";

import { ANALYTICS_PERIODS, type AnalyticsPeriod } from "@trefix/api-client";
import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import { Label } from "@trefix/ui/components/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@trefix/ui/components/select";
import { Switch } from "@trefix/ui/components/switch";
import { Tabs, TabsList, TabsTrigger } from "@trefix/ui/components/tabs";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@trefix/ui/components/toggle-group";
import { RefreshCwIcon } from "lucide-react";

import { useI18n } from "@/shared/i18n";
import { PageHeader } from "@/widgets/page-header";

import {
  useAnalyticsAttention,
  useAnalyticsSummary,
} from "../hooks/use-analytics";
import {
  ANALYTICS_TABS,
  type AnalyticsTab,
  useAnalyticsFilters,
} from "../hooks/use-analytics-filters";
import { formatNumber, formatSince } from "../lib/format";
import { ActivityChart } from "./activity-chart";
import { SectionCards } from "./section-cards";
import { AttentionTab } from "./tabs/attention-tab";
import { AudienceTab } from "./tabs/audience-tab";
import { CoachTab } from "./tabs/coach-tab";
import { EngagementTab } from "./tabs/engagement-tab";
import { OutcomesTab } from "./tabs/outcomes-tab";
import { PlansTab } from "./tabs/plans-tab";

/**
 * Product analytics, laid out like the shadcn dashboard-01 block: KPI cards,
 * an interactive activity chart, then tabs with details. Filters live in the
 * URL. The first tab answers the main question: do people reach their goals.
 */
export function AnalyticsDashboard(): ReactElement {
  const { t, locale } = useI18n();
  const {
    filters,
    range,
    tab,
    setPeriod,
    setIncludeStaff,
    setRange,
    setTab,
    refresh,
  } = useAnalyticsFilters();
  const summary = useAnalyticsSummary(filters);
  // The count on the tab comes from the first page of the list, shared with the tab itself.
  const attention = useAnalyticsAttention(filters, {
    types: [],
    page: 1,
    limit: 20,
    sortBy: "severity",
  });
  const attentionTotal =
    attention.data?.counts.reduce((sum, row) => sum + row.count, 0) ?? 0;
  const periodLabel = (value: AnalyticsPeriod): string =>
    t(`analytics.periods.${value}`);
  const generatedAt = summary.data?.generatedAt;

  const tabs: Record<AnalyticsTab, ReactElement> = {
    outcomes: <OutcomesTab filters={filters} />,
    engagement: <EngagementTab filters={filters} />,
    plans: <PlansTab filters={filters} />,
    coach: <CoachTab filters={filters} />,
    audience: <AudienceTab filters={filters} />,
    attention: <AttentionTab filters={filters} />,
  };

  return (
    <div className="@container/main flex flex-col gap-6">
      <PageHeader
        title={t("analytics.title")}
        description={t("analytics.subtitle")}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={[filters.period]}
              onValueChange={(value: string[]) => {
                const next = value[0] as AnalyticsPeriod | undefined;
                if (next) setPeriod(next);
              }}
              className="hidden @3xl/main:flex"
            >
              {ANALYTICS_PERIODS.map((value) => (
                <ToggleGroupItem key={value} value={value} className="px-3">
                  {periodLabel(value)}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <Select
              items={ANALYTICS_PERIODS.map((value) => ({
                value,
                label: periodLabel(value),
              }))}
              value={filters.period}
              onValueChange={(next) => {
                if (next) setPeriod(next as AnalyticsPeriod);
              }}
            >
              <SelectTrigger
                size="sm"
                className="w-32 @3xl/main:hidden"
                aria-label={t("analytics.period")}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ANALYTICS_PERIODS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {periodLabel(value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                id="analytics-staff"
                checked={filters.includeStaff}
                onCheckedChange={(checked) => setIncludeStaff(checked)}
              />
              <Label htmlFor="analytics-staff" className="whitespace-nowrap">
                {t("analytics.includeStaff")}
              </Label>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              disabled={summary.isFetching}
            >
              <RefreshCwIcon
                className={summary.isFetching ? "animate-spin" : undefined}
              />
              {t("common.actions.refresh")}
            </Button>
            {generatedAt ? (
              <span className="text-xs whitespace-nowrap text-muted-foreground">
                {t("analytics.updated", {
                  when: formatSince(generatedAt, locale),
                })}
              </span>
            ) : null}
          </div>
        }
      />

      <SectionCards summary={summary.data} loading={summary.isPending} />

      <ActivityChart filters={filters} range={range} onRangeChange={setRange} />

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as AnalyticsTab)}
        className="flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-2">
          <Select
            items={ANALYTICS_TABS.map((value) => ({
              value,
              label: t(`analytics.tabs.${value}`),
            }))}
            value={tab}
            onValueChange={(next) => {
              if (next) setTab(next as AnalyticsTab);
            }}
          >
            <SelectTrigger
              size="sm"
              className="w-52 @4xl/main:hidden"
              aria-label={t("analytics.tabsLabel")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANALYTICS_TABS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(`analytics.tabs.${value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <TabsList className="hidden @4xl/main:flex">
            {ANALYTICS_TABS.map((value) => (
              <TabsTrigger key={value} value={value} className="px-3">
                {t(`analytics.tabs.${value}`)}
                {value === "attention" && attentionTotal > 0 ? (
                  <Badge variant="secondary" className="tabular-nums">
                    {formatNumber(attentionTotal, locale)}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tabs[tab]}
      </Tabs>
    </div>
  );
}
