"use client";

import Link from "next/link";
import { useState, type ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trefix/ui/components/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@trefix/ui/components/toggle-group";
import { formatHoursMinutesSeconds } from "@trefix/utils";
import { PlusIcon, Trash2Icon } from "lucide-react";

import type { ProgressSummary } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { NoAthlete } from "@/features/users/components/card/no-athlete";
import {
  HeartRateZonesChart,
  MonthlyDistanceChart,
  PaceTrendChart,
  RecordHistoryChart,
  RegularityGrid,
  WeeklyKmChart,
} from "@/features/users/components/charts/card-charts";
import { isNotFound } from "@/features/users/lib/card-errors";
import {
  formatKm,
  formatPaceSeconds,
  formatShortDate,
} from "@/features/users/lib/card-format";
import { useI18n } from "@/shared/i18n";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import {
  DetailSkeleton,
  ErrorState,
  TableSkeleton,
} from "@/widgets/data-state";

import {
  useProgressActions,
  useUserProgressSummary,
  useUserRecordHistory,
  useUserRecords,
} from "../hooks/use-user-athlete";
import { AddResultDialog } from "./add-result-dialog";

const PERIODS = ["week", "month", "year"] as const;

function PeriodCards({ summary }: { summary: ProgressSummary }): ReactElement {
  const { t, locale } = useI18n();
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {PERIODS.map((period) => {
        const comparison = summary.comparison[period];
        return (
          <Card key={period} size="sm">
            <CardHeader>
              <CardDescription>
                {t(`userCard.progress.periods.${period}`)}
              </CardDescription>
              <CardTitle className="text-xl font-medium">
                {t("userCard.overview.km", {
                  value: formatKm(comparison.totals.distanceKm, locale),
                })}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
              <span>
                {t("userCard.progress.workoutsCount", {
                  count: comparison.totals.count,
                })}
              </span>
              <span>
                {t("userCard.overview.pace", {
                  value: formatPaceSeconds(comparison.avgPaceSecPerKm),
                })}
              </span>
              <span>
                {t("userCard.progress.longest", {
                  value: formatKm(comparison.longestKm, locale),
                })}
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

type VolumeView = "weeks" | "months";

function ProgressCharts({
  summary,
}: {
  summary: ProgressSummary;
}): ReactElement {
  const { t } = useI18n();
  const [view, setView] = useState<VolumeView>("weeks");
  const { analytics } = summary;
  const months = summary.months.slice(-12);
  const easyPace = analytics.pace.easy;

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Card className="xl:col-span-2">
        <CardHeader>
          <CardTitle>{t("userCard.charts.volumeTitle")}</CardTitle>
          <CardDescription>
            {view === "weeks"
              ? t("userCard.charts.weeklyKmDescription")
              : t("userCard.charts.monthlyKmDescription")}
          </CardDescription>
          <CardAction>
            <ToggleGroup
              variant="outline"
              size="sm"
              spacing={0}
              value={[view]}
              onValueChange={(value: string[]) => {
                const next = value[0] as VolumeView | undefined;
                if (next) setView(next);
              }}
            >
              <ToggleGroupItem value="weeks">
                {t("userCard.charts.weeks")}
              </ToggleGroupItem>
              <ToggleGroupItem value="months">
                {t("userCard.charts.months")}
              </ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent>
          {view === "weeks" ? (
            <WeeklyKmChart weeks={analytics.weeklyKm} className="h-56" />
          ) : (
            <MonthlyDistanceChart months={months} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("userCard.charts.regularityTitle")}</CardTitle>
          <CardDescription>
            {t("userCard.charts.regularityDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RegularityGrid weeks={analytics.regularity} />
        </CardContent>
      </Card>

      {easyPace.length > 1 ? (
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>{t("userCard.charts.easyPaceTitle")}</CardTitle>
            <CardDescription>
              {t("userCard.charts.easyPaceDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PaceTrendChart points={easyPace} />
          </CardContent>
        </Card>
      ) : null}

      {analytics.heartRateZones ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("userCard.charts.zonesTitle")}</CardTitle>
            <CardDescription>
              {analytics.avgHeartRate
                ? t("userCard.charts.zonesDescription", {
                    value: analytics.avgHeartRate,
                  })
                : t("userCard.charts.zonesDescriptionNoAvg")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <HeartRateZonesChart zones={analytics.heartRateZones} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function RecordHistory({
  userId,
  distance,
  canManage,
}: {
  userId: string;
  distance: string;
  canManage: boolean;
}): ReactElement {
  const { t, locale } = useI18n();
  const query = useUserRecordHistory(userId, distance);
  const { deleteResult } = useProgressActions(userId);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  if (query.isLoading) return <TableSkeleton rows={3} columns={4} />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  return (
    <>
      {query.data.attempts.length > 1 ? (
        <RecordHistoryChart attempts={query.data.attempts} />
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("userCard.progress.columns.date")}</TableHead>
            <TableHead>{t("userCard.progress.columns.time")}</TableHead>
            <TableHead>{t("userCard.progress.columns.source")}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {query.data.attempts.map((attempt) => (
            <TableRow key={attempt.id}>
              <TableCell>{formatShortDate(attempt.date, locale)}</TableCell>
              <TableCell className="tabular-nums">
                {formatHoursMinutesSeconds(attempt.seconds)}
              </TableCell>
              <TableCell>
                {attempt.workoutId ? (
                  <Link
                    href={`/users/${userId}/workouts/${attempt.workoutId}`}
                    className="underline underline-offset-4"
                  >
                    {attempt.name ??
                      t(`userCard.progress.kinds.${attempt.kind}`)}
                  </Link>
                ) : (
                  (attempt.name ?? t(`userCard.progress.kinds.${attempt.kind}`))
                )}
              </TableCell>
              <TableCell className="text-right">
                {canManage && attempt.resultId ? (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("common.actions.delete")}
                    onClick={() => setPendingDelete(attempt.resultId)}
                  >
                    <Trash2Icon />
                  </Button>
                ) : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={t("userCard.progress.deleteResult.title")}
        description={t("userCard.progress.deleteResult.description")}
        confirmLabel={t("common.actions.delete")}
        isPending={deleteResult.isPending}
        onConfirm={() =>
          pendingDelete &&
          deleteResult.mutate(pendingDelete, {
            onSuccess: () => setPendingDelete(null),
          })
        }
      />
    </>
  );
}

export function UserProgressSection({
  userId,
}: {
  userId: string;
}): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const summary = useUserProgressSummary(userId);
  const records = useUserRecords(userId);
  const { addResult } = useProgressActions(userId);
  const [selected, setSelected] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const canManage = hasPermission("training.userprogress.manage");

  if (summary.isLoading) return <DetailSkeleton />;
  if (isNotFound(summary.error)) return <NoAthlete />;
  if (summary.isError || !summary.data) {
    return <ErrorState onRetry={() => summary.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <PeriodCards summary={summary.data} />
      <ProgressCharts summary={summary.data} />

      <Card>
        <CardHeader>
          <CardTitle>{t("userCard.progress.recordsTitle")}</CardTitle>
          <CardDescription>
            {t("userCard.progress.recordsDescription")}
          </CardDescription>
          {canManage ? (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAddOpen(true)}
              >
                <PlusIcon />
                {t("userCard.progress.addResult.action")}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {records.isLoading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : records.isError || !records.data ? (
            <ErrorState onRetry={() => records.refetch()} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    {t("userCard.progress.columns.distance")}
                  </TableHead>
                  <TableHead>{t("userCard.progress.columns.best")}</TableHead>
                  <TableHead>{t("userCard.progress.columns.date")}</TableHead>
                  <TableHead>
                    {t("userCard.progress.columns.prediction")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.data.items.map((record) => (
                  <TableRow
                    key={record.distance}
                    data-state={
                      selected === record.distance ? "selected" : undefined
                    }
                    className="cursor-pointer"
                    onClick={() =>
                      setSelected((current) =>
                        current === record.distance ? null : record.distance,
                      )
                    }
                  >
                    <TableCell className="font-medium">
                      {t(`userCard.progress.distances.${record.distance}`)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {record.best ? (
                        <span className="flex items-center gap-2">
                          {formatHoursMinutesSeconds(record.best.seconds)}
                          {record.best.isNew ? (
                            <Badge variant="outline">
                              {t("userCard.progress.new")}
                            </Badge>
                          ) : null}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {record.best
                        ? formatShortDate(record.best.date, locale)
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {record.predictionSeconds
                        ? formatHoursMinutesSeconds(record.predictionSeconds)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {selected ? (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">
                {t("userCard.progress.historyTitle", {
                  distance: t(`userCard.progress.distances.${selected}`),
                })}
              </span>
              <RecordHistory
                userId={userId}
                distance={selected}
                canManage={canManage}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AddResultDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        isPending={addResult.isPending}
        onSubmit={(input) =>
          addResult.mutate(input, { onSuccess: () => setAddOpen(false) })
        }
      />
    </div>
  );
}
