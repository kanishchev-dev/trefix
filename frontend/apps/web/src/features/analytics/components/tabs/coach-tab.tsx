"use client";

import { useState, type ReactElement } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trefix/ui/components/table";
import { Tabs, TabsList, TabsTrigger } from "@trefix/ui/components/tabs";

import type { AnalyticsFilters } from "@/entities/analytics/api";
import { useI18n } from "@/shared/i18n";
import { ErrorState } from "@/widgets/data-state";

import { useAnalyticsCoach } from "../../hooks/use-analytics";
import {
  formatCompact,
  formatDay,
  formatNumber,
  formatPercent,
  formatUsd,
} from "../../lib/format";
import { ChartCard, StatRow } from "../chart-card";
import { SeriesBarChart, SeriesLineChart } from "../charts";

type Breakdown = "byFeature" | "byModel";

/** Tref, the AI coach: usage, proactive replies, results and cost. */
export function CoachTab({
  filters,
}: {
  filters: AnalyticsFilters;
}): ReactElement {
  const { t, locale } = useI18n();
  const [breakdown, setBreakdown] = useState<Breakdown>("byFeature");
  const query = useAnalyticsCoach(filters, true);
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const data = query.data;
  const loading = query.isPending;
  const num = (value: number | null | undefined): string =>
    formatNumber(value, locale);
  const usd = (value: number | null | undefined, digits = 2): string =>
    formatUsd(value, locale, digits);
  const messages = data?.messages ?? [];
  const llm = data?.llm;

  return (
    <div className="grid gap-4 @3xl/main:grid-cols-2">
      <ChartCard
        title={t("analytics.coach.messages")}
        description={
          data
            ? t("analytics.coach.messagesCaption", {
                enabled: formatPercent(data.enabledShare, locale),
                users: num(data.activeUsers),
              })
            : undefined
        }
        loading={loading}
        empty={messages.every(
          (row) => row.userMessages + row.coachReplies + row.proactive === 0,
        )}
      >
        <SeriesLineChart
          area
          data={messages.map((row) => ({
            label: formatDay(row.date, locale),
            userMessages: row.userMessages,
            proactive: row.proactive,
          }))}
          series={[
            { key: "userMessages", label: t("analytics.coach.userMessages") },
            { key: "proactive", label: t("analytics.coach.proactiveMessages") },
          ]}
          domain={[0, "auto"]}
          formatValue={num}
        />
      </ChartCard>

      <ChartCard
        title={t("analytics.coach.proactive")}
        description={
          data?.proactive.replyRate !== null && data
            ? t("analytics.coach.replyRate", {
                value: formatPercent(data.proactive.replyRate, locale),
              })
            : undefined
        }
        loading={loading}
      >
        {data ? (
          <div className="flex flex-col gap-5">
            <StatRow
              items={[
                {
                  label: t("analytics.coach.sent"),
                  value: num(data.proactive.sent),
                },
                {
                  label: t("analytics.coach.replied"),
                  value: num(data.proactive.replied24h),
                },
                {
                  label: t("analytics.coach.perSession"),
                  value: num(data.messagesPerSession),
                },
              ]}
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">
                {t("analytics.coach.workoutNotes")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("analytics.coach.workoutNotesTotal", {
                  total: num(data.workoutNotes.total),
                })}
              </span>
            </div>
            {data.workoutNotes.total > 0 ? (
              <SeriesBarChart
                height={140}
                data={data.workoutNotes.daily.map((row) => ({
                  label: formatDay(row.date, locale),
                  notes: row.notes,
                }))}
                series={[{ key: "notes", label: t("analytics.coach.notes") }]}
                formatValue={num}
              />
            ) : null}
          </div>
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.coach.effect")}
        description={t("analytics.coach.effectCaption")}
        loading={loading}
        empty={
          !data ||
          data.effect.every(
            (row) => row.enabled === null && row.disabled === null,
          )
        }
      >
        {data ? (
          <SeriesBarChart
            data={data.effect.map((row) => ({
              label: t(`analytics.coach.effects.${row.metric}`),
              enabled: row.enabled,
              disabled: row.disabled,
            }))}
            series={[
              { key: "enabled", label: t("analytics.coach.enabled") },
              { key: "disabled", label: t("analytics.coach.disabled") },
            ]}
            formatValue={(value) => formatPercent(value, locale)}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.coach.cost")}
        description={
          llm?.costPerActiveUserUsd !== null && llm
            ? t("analytics.coach.costPerUser", {
                value: usd(llm.costPerActiveUserUsd, 3),
              })
            : undefined
        }
        loading={loading}
        empty={!llm?.calls}
        emptyHint={t("analytics.empty.llm")}
      >
        {llm ? (
          <div className="flex flex-col gap-5">
            <StatRow
              items={[
                { label: t("analytics.coach.total"), value: usd(llm.costUsd) },
                {
                  label: t("analytics.coach.tokens"),
                  value: formatCompact(
                    llm.inputTokens + llm.outputTokens,
                    locale,
                  ),
                },
                {
                  label: t("analytics.coach.failed"),
                  value: formatPercent(llm.failedShare, locale),
                },
                {
                  label: t("analytics.coach.latency"),
                  value:
                    llm.p95LatencyMs === null
                      ? "—"
                      : t("analytics.units.seconds", {
                          value: num(llm.p95LatencyMs / 1000),
                        }),
                },
              ]}
            />
            <SeriesLineChart
              area
              height={150}
              data={llm.daily.map((row) => ({
                label: formatDay(row.date, locale),
                cost: row.costUsd,
              }))}
              series={[{ key: "cost", label: t("analytics.coach.costPerDay") }]}
              domain={[0, "auto"]}
              formatValue={(value) => usd(value, 3)}
              formatTick={(value) => usd(value, 3)}
            />
            <Tabs
              value={breakdown}
              onValueChange={(value) => setBreakdown(value as Breakdown)}
            >
              <TabsList>
                <TabsTrigger value="byFeature">
                  {t("analytics.coach.byFeature")}
                </TabsTrigger>
                <TabsTrigger value="byModel">
                  {t("analytics.coach.byModel")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t(
                      breakdown === "byFeature"
                        ? "analytics.coach.feature"
                        : "analytics.coach.model",
                    )}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("analytics.coach.calls")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("analytics.coach.tokens")}
                  </TableHead>
                  <TableHead className="text-right">
                    {t("analytics.coach.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {llm[breakdown].map((row) => (
                  <TableRow key={row.key}>
                    <TableCell className="max-w-48 truncate">
                      {breakdown === "byFeature"
                        ? t(`analytics.coach.features.${row.key}`)
                        : row.key}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(row.calls)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCompact(
                        row.inputTokens + row.outputTokens,
                        locale,
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {usd(row.costUsd)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}
      </ChartCard>
    </div>
  );
}
