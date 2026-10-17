"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import {
  ANALYTICS_ATTENTION_TYPES,
  type AnalyticsAttentionItem,
  type AnalyticsAttentionSeverity,
  type AnalyticsAttentionType,
} from "@trefix/api-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@trefix/ui/components/avatar";
import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import { Card, CardContent } from "@trefix/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@trefix/ui/components/dropdown-menu";
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
import { cn } from "@trefix/ui/lib/utils";
import {
  BellIcon,
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PlugIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import type { AnalyticsFilters } from "@/entities/analytics/api";
import { ComposeBroadcastDialog } from "@/features/notifications/components/compose-broadcast-dialog";
import { userSectionHref } from "@/features/users/lib/user-sections";
import { formatDate, useI18n } from "@/shared/i18n";
import { ErrorState, TableSkeleton } from "@/widgets/data-state";

import { useAnalyticsAttention } from "../../hooks/use-analytics";
import {
  formatDay,
  formatNumber,
  formatPercent,
  formatSince,
} from "../../lib/format";

const PAGE_SIZE = 20;
const ALL = "all";

const SEVERITY_DOT: Record<AnalyticsAttentionSeverity, string> = {
  high: "bg-foreground",
  medium: "bg-muted-foreground",
  low: "bg-muted-foreground/40",
};

function initials(firstName: string, lastName: string, email: string): string {
  const value = `${firstName.charAt(0)}${lastName.charAt(0)}`.trim();
  return (value || email.charAt(0)).toUpperCase();
}

/** Users that need an administrator, with a way to reach each of them. */
export function AttentionTab({
  filters,
}: {
  filters: AnalyticsFilters;
}): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const router = useRouter();
  const [type, setType] = useState<AnalyticsAttentionType | typeof ALL>(ALL);
  const [page, setPage] = useState(1);
  const [notifyUser, setNotifyUser] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const query = useAnalyticsAttention(filters, {
    types: type === ALL ? [] : [type],
    page,
    limit: PAGE_SIZE,
    sortBy: "severity",
  });
  const canOpenUsers = hasPermission("users.read");
  const canNotify = hasPermission("notifications.broadcasts.send");

  if (query.isError) return <ErrorState onRetry={() => void query.refetch()} />;
  const data = query.data;
  const counts = new Map(
    data?.counts.map((row) => [row.type, row.count]) ?? [],
  );
  const total = data?.counts.reduce((sum, row) => sum + row.count, 0) ?? 0;

  const details = (item: AnalyticsAttentionItem): string => {
    const d = item.details;
    switch (item.type) {
      case "churn_risk":
        return t("analytics.attention.details.churn_risk", {
          days: formatNumber(d.daysWithoutWorkout, locale),
          plan: d.planName ?? "—",
        });
      case "overload_risk":
        return t("analytics.attention.details.overload_risk", {
          ratio: formatNumber(d.ratio, locale, 2),
        });
      case "goal_at_risk":
        return t("analytics.attention.details.goal_at_risk", {
          goal: d.goalType ? t(`analytics.goalTypes.${d.goalType}`) : "—",
          date: d.targetDate ? formatDay(d.targetDate, locale) : "—",
          progress: formatPercent(d.progressPct, locale),
        });
      case "integration_error":
        return t("analytics.attention.details.integration_error", {
          provider: t(`analytics.sources.${d.provider ?? "other"}`),
          status: t(
            `analytics.attention.integrationStatus.${d.status ?? "error"}`,
          ),
        });
      case "sync_stale":
        return t("analytics.attention.details.sync_stale", {
          provider: t(`analytics.sources.${d.provider ?? "other"}`),
          hours: formatNumber(d.hoursSinceSync, locale),
        });
      case "notification_failed":
        return t("analytics.attention.details.notification_failed", {
          failures: formatNumber(d.failures, locale),
          channels: (d.channels ?? [])
            .map((channel) => t(`analytics.attention.channels.${channel}`))
            .join(", "),
        });
      default:
        return t(`analytics.attention.details.${item.type}`);
    }
  };

  const sectionFor = (item: AnalyticsAttentionItem) => {
    switch (item.type) {
      case "churn_risk":
      case "overload_risk":
        return {
          href: userSectionHref(item.user.id, "calendar"),
          icon: CalendarDaysIcon,
          label: t("analytics.attention.openCalendar"),
        };
      case "goal_at_risk":
        return {
          href: userSectionHref(item.user.id, "plans"),
          icon: CalendarDaysIcon,
          label: t("analytics.attention.openPlans"),
        };
      case "integration_error":
      case "sync_stale":
        return {
          href: userSectionHref(item.user.id, "integrations"),
          icon: PlugIcon,
          label: t("analytics.attention.openIntegrations"),
        };
      case "notification_failed":
        return {
          href: userSectionHref(item.user.id, "notifications"),
          icon: BellIcon,
          label: t("analytics.attention.openNotifications"),
        };
      default:
        return {
          href: userSectionHref(item.user.id, "account"),
          icon: EyeIcon,
          label: t("analytics.attention.openAccount"),
        };
    }
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="overflow-x-auto">
          <ToggleGroup
            variant="outline"
            size="sm"
            spacing={0}
            value={[type]}
            onValueChange={(value: string[]) => {
              const next = value[0];
              if (!next) return;
              setType(next as AnalyticsAttentionType | typeof ALL);
              setPage(1);
            }}
          >
            <ToggleGroupItem value={ALL} className="px-3 whitespace-nowrap">
              {t("analytics.attention.all")}
              <span className="text-muted-foreground tabular-nums">
                {formatNumber(total, locale)}
              </span>
            </ToggleGroupItem>
            {ANALYTICS_ATTENTION_TYPES.filter(
              (item) => (counts.get(item) ?? 0) > 0 || item === type,
            ).map((item) => (
              <ToggleGroupItem
                key={item}
                value={item}
                className="px-3 whitespace-nowrap"
              >
                {t(`analytics.attention.types.${item}`)}
                <span className="text-muted-foreground tabular-nums">
                  {formatNumber(counts.get(item) ?? 0, locale)}
                </span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {query.isPending ? (
          <TableSkeleton rows={6} columns={5} />
        ) : !data?.data.length ? (
          <div className="flex h-40 flex-col items-center justify-center gap-1 text-center">
            <span className="text-sm font-medium">
              {t("analytics.attention.emptyTitle")}
            </span>
            <span className="text-sm text-muted-foreground">
              {t("analytics.attention.emptyDescription")}
            </span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("analytics.attention.columns.user")}</TableHead>
                  <TableHead>
                    {t("analytics.attention.columns.problem")}
                  </TableHead>
                  <TableHead>
                    {t("analytics.attention.columns.severity")}
                  </TableHead>
                  <TableHead>
                    {t("analytics.attention.columns.since")}
                  </TableHead>
                  <TableHead>
                    {t("analytics.attention.columns.details")}
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((item) => {
                  const name =
                    `${item.user.firstName} ${item.user.lastName}`.trim() ||
                    item.user.email;
                  const section = sectionFor(item);
                  const SectionIcon = section.icon;
                  const person = (
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar className="size-8">
                        <AvatarImage
                          src={item.user.avatarUrl ?? undefined}
                          alt=""
                        />
                        <AvatarFallback className="text-xs">
                          {initials(
                            item.user.firstName,
                            item.user.lastName,
                            item.user.email,
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate font-medium">{name}</span>
                    </span>
                  );
                  return (
                    <TableRow
                      key={`${item.type}:${item.user.id}:${item.details.planId ?? item.details.goalId ?? item.details.provider ?? item.details.exportId ?? ""}`}
                    >
                      <TableCell className="max-w-56">
                        {canOpenUsers ? (
                          <Link
                            href={`/users/${item.user.id}`}
                            className="hover:underline"
                          >
                            {person}
                          </Link>
                        ) : (
                          person
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="whitespace-nowrap">
                          {t(`analytics.attention.types.${item.type}`)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              SEVERITY_DOT[item.severity],
                            )}
                          />
                          {t(`analytics.attention.severity.${item.severity}`)}
                        </span>
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap text-muted-foreground"
                        title={formatDate(item.since, locale)}
                      >
                        {formatSince(item.since, locale)}
                      </TableCell>
                      <TableCell className="max-w-96 truncate text-muted-foreground">
                        {details(item)}
                      </TableCell>
                      <TableCell>
                        {canOpenUsers || canNotify ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={t("common.table.actions")}
                                />
                              }
                            >
                              <MoreHorizontalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canOpenUsers ? (
                                <>
                                  <DropdownMenuItem
                                    onClick={() =>
                                      router.push(`/users/${item.user.id}`)
                                    }
                                  >
                                    <EyeIcon />
                                    {t("analytics.attention.openUser")}
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => router.push(section.href)}
                                  >
                                    <SectionIcon />
                                    {section.label}
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                              {canNotify ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    setNotifyUser({ id: item.user.id, name })
                                  }
                                >
                                  <BellIcon />
                                  {t("analytics.attention.notify")}
                                </DropdownMenuItem>
                              ) : null}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {data && data.meta.total > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              {t("common.table.rowsTotal", { total: data.meta.total })}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!data.meta.hasPreviousPage}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                aria-label={t("common.table.previous")}
              >
                <ChevronLeftIcon />
              </Button>
              <span className="text-sm whitespace-nowrap text-muted-foreground">
                {t("common.pagination.page", {
                  page: data.meta.page,
                  totalPages: Math.max(data.meta.totalPages, 1),
                })}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                disabled={!data.meta.hasNextPage}
                onClick={() => setPage((value) => value + 1)}
                aria-label={t("common.table.next")}
              >
                <ChevronRightIcon />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>

      <ComposeBroadcastDialog
        open={notifyUser !== null}
        onOpenChange={(open) => {
          if (!open) setNotifyUser(null);
        }}
        user={notifyUser ?? undefined}
      />
    </Card>
  );
}
