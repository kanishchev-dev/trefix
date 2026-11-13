"use client";

import type { ReactElement } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trefix/ui/components/table";

import type { AnalyticsFilters } from "@/entities/analytics/api";
import { useI18n } from "@/shared/i18n";
import { ErrorState } from "@/widgets/data-state";

import { useAnalyticsAudience } from "../../hooks/use-analytics";
import { formatDay, formatNumber, formatPercent, sum } from "../../lib/format";
import { ChartCard, StatRow } from "../chart-card";
import { FunnelBars, SeriesBarChart, SeriesLineChart } from "../charts";

/** Who the users are: sign-ups, activation, platforms, services. */
export function AudienceTab({
  filters,
}: {
  filters: AnalyticsFilters;
}): ReactElement {
  const { t, locale } = useI18n();
  const query = useAnalyticsAudience(filters, true);
  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const data = query.data;
  const loading = query.isPending;
  const num = (value: number | null | undefined): string =>
    formatNumber(value, locale);
  const funnel = data?.activationFunnel ?? [];
  const registered = funnel[0]?.count ?? 0;
  const firstWorkout =
    funnel.find((step) => step.step === "first_workout")?.count ?? 0;
  const platformUsers = sum((data?.platforms ?? []).map((row) => row.users));
  const versionUsers = sum((data?.appVersions ?? []).map((row) => row.users));

  return (
    <div className="grid gap-4 @3xl/main:grid-cols-2">
      <ChartCard
        title={t("analytics.audience.registrations")}
        description={
          data
            ? t("analytics.audience.totals", {
                users: num(data.totals.users),
                blocked: num(data.totals.blocked),
                deleted: num(data.totals.deletedInPeriod),
              })
            : undefined
        }
        loading={loading}
        footer={
          data?.registrationsByProvider.length ? (
            <StatRow
              items={data.registrationsByProvider.map((row) => ({
                label: t(`analytics.audience.providers.${row.provider}`),
                value: num(row.users),
              }))}
            />
          ) : undefined
        }
      >
        {data ? (
          <SeriesLineChart
            area
            data={data.registrations.map((row) => ({
              label: formatDay(row.date, locale),
              users: row.users,
            }))}
            series={[{ key: "users", label: t("analytics.audience.newUsers") }]}
            domain={[0, "auto"]}
            formatValue={num}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.audience.activation")}
        description={
          registered
            ? t("analytics.audience.activationCaption", {
                share: Math.round((firstWorkout / registered) * 100),
              })
            : undefined
        }
        loading={loading}
        empty={!registered}
      >
        <FunnelBars
          steps={funnel.map((step) => ({
            label: t(`analytics.funnel.${step.step}`),
            count: step.count,
          }))}
          formatValue={num}
        />
      </ChartCard>

      <ChartCard
        title={t("analytics.audience.platforms")}
        description={t("analytics.audience.platformsCaption")}
        loading={loading}
        empty={!data?.platforms.length && !data?.appVersions.length}
      >
        {data ? (
          <div className="flex flex-col gap-4">
            <StatRow
              items={data.platforms.map((row) => ({
                label: t(`analytics.audience.platformNames.${row.platform}`),
                value: formatPercent(
                  platformUsers ? (row.users / platformUsers) * 100 : null,
                  locale,
                ),
              }))}
            />
            {data.appVersions.length ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("analytics.audience.platform")}</TableHead>
                    <TableHead>{t("analytics.audience.version")}</TableHead>
                    <TableHead className="text-right">
                      {t("analytics.audience.users")}
                    </TableHead>
                    <TableHead className="text-right">
                      {t("analytics.audience.share")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.appVersions.slice(0, 8).map((row) => (
                    <TableRow key={`${row.platform}:${row.appVersion ?? ""}`}>
                      <TableCell>
                        {t(`analytics.audience.platformNames.${row.platform}`)}
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {row.appVersion ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {num(row.users)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatPercent(
                          versionUsers
                            ? (row.users / versionUsers) * 100
                            : null,
                          locale,
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : null}
          </div>
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.audience.integrations")}
        description={
          data
            ? t("analytics.audience.integrationsCaption", {
                share: formatPercent(data.usersWithIntegrationShare, locale),
              })
            : undefined
        }
        loading={loading}
        empty={!data?.integrations.length}
      >
        {data ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("analytics.audience.service")}</TableHead>
                <TableHead className="text-right">
                  {t("analytics.audience.connected")}
                </TableHead>
                <TableHead className="text-right">
                  {t("analytics.audience.errors")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.integrations.map((row) => (
                <TableRow key={row.provider}>
                  <TableCell>
                    {t(`analytics.sources.${row.provider}`)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(row.connected)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {num(row.errors)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.audience.experience")}
        loading={loading}
        empty={!data?.experience.length}
      >
        {data ? (
          <SeriesBarChart
            layout="horizontal"
            height={Math.max(data.experience.length * 36 + 24, 100)}
            data={data.experience.map((row) => ({
              label: t(`analytics.audience.levels.${row.level}`),
              athletes: row.athletes,
            }))}
            series={[
              { key: "athletes", label: t("analytics.audience.athletes") },
            ]}
            formatValue={num}
          />
        ) : null}
      </ChartCard>

      <ChartCard
        title={t("analytics.audience.languages")}
        loading={loading}
        empty={!data?.languages.length}
      >
        {data ? (
          <SeriesBarChart
            layout="horizontal"
            height={Math.max(data.languages.length * 36 + 24, 100)}
            data={data.languages.map((row) => ({
              label: t(`analytics.audience.languageNames.${row.language}`),
              users: row.users,
            }))}
            series={[{ key: "users", label: t("analytics.audience.users") }]}
            formatValue={num}
          />
        ) : null}
      </ChartCard>
    </div>
  );
}
