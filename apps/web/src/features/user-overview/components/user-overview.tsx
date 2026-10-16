"use client";

import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { buttonVariants } from "@trefix/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import { Progress } from "@trefix/ui/components/progress";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@trefix/ui/components/item";
import {
  CalendarXIcon,
  ChevronRightIcon,
  FootprintsIcon,
  GitPullRequestArrowIcon,
  PlugIcon,
  PlugZapIcon,
  SparklesIcon,
  type LucideIcon,
} from "lucide-react";

import type { AdminOverview } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { ActivityFeed } from "@/features/activity/components/activity-feed";
import { useUserProgressSummary } from "@/features/user-athlete/hooks/use-user-athlete";
import { WeeklyKmChart } from "@/features/users/components/charts/card-charts";
import { useUserActivity } from "@/features/activity/hooks/use-activity";
import {
  formatKm,
  formatPaceSeconds,
  formatShortDate,
} from "@/features/users/lib/card-format";
import { userSectionHref } from "@/features/users/lib/user-sections";
import { formatDate, useI18n } from "@/shared/i18n";
import { DetailSkeleton, EmptyState, ErrorState } from "@/widgets/data-state";

import { useUserOverview } from "../hooks/use-user-overview";

type Attention = AdminOverview["attention"][number];
type OverviewWorkout = AdminOverview["upcomingWorkouts"][number];

const ATTENTION_ICONS: Record<Attention["code"], LucideIcon> = {
  adaptation_pending: GitPullRequestArrowIcon,
  missed_workouts: CalendarXIcon,
  gear_replace_soon: FootprintsIcon,
  integration_error: PlugZapIcon,
};

function StatCard({
  title,
  value,
  hint,
  children,
}: {
  title: string;
  value: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}): ReactElement {
  return (
    <Card size="sm">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-xl font-medium">{value}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm text-muted-foreground">
        {children}
        {hint ? <span>{hint}</span> : null}
      </CardContent>
    </Card>
  );
}

function attentionHref(userId: string, item: Attention): string {
  switch (item.code) {
    case "adaptation_pending":
      return userSectionHref(userId, "plans");
    case "missed_workouts":
      return userSectionHref(userId, "calendar");
    case "gear_replace_soon":
      return userSectionHref(userId, "gear");
    case "integration_error":
      return userSectionHref(userId, "integrations");
  }
}

function WorkoutLine({
  userId,
  workout,
}: {
  userId: string;
  workout: OverviewWorkout;
}): ReactElement {
  const { t, locale } = useI18n();
  const typeLabel = t(`trainingCalendar.types.${workout.type}`);
  const date = new Date(workout.scheduledAt);
  return (
    <Item
      size="sm"
      render={<Link href={`/users/${userId}/workouts/${workout.id}`} />}
    >
      <ItemMedia className="w-10 flex-col gap-0 rounded-xl border py-1 text-center leading-tight">
        <span className="text-sm font-medium tabular-nums">
          {date.getDate()}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {new Intl.DateTimeFormat(locale, { weekday: "short" }).format(date)}
        </span>
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{workout.title ?? typeLabel}</ItemTitle>
        <ItemDescription>
          {formatShortDate(workout.scheduledAt, locale, true)} ·{" "}
          {t("userCard.overview.km", {
            value: formatKm(workout.distanceKm, locale),
          })}
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Badge variant="outline">
          {t(`trainingCalendar.statuses.${workout.status}`)}
        </Badge>
      </ItemActions>
    </Item>
  );
}

function WeeklyVolume({ userId }: { userId: string }): ReactElement | null {
  const { t } = useI18n();
  const query = useUserProgressSummary(userId);
  const weeks = query.data?.analytics.weeklyKm ?? [];
  if (weeks.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.charts.weeklyKmTitle")}</CardTitle>
        <CardDescription>
          {t("userCard.charts.weeklyKmDescription")}
        </CardDescription>
        <CardAction>
          <Link
            href={userSectionHref(userId, "progress")}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("userCard.sections.progress.title")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        <WeeklyKmChart weeks={weeks} />
      </CardContent>
    </Card>
  );
}

function RecentActivity({ userId }: { userId: string }): ReactElement | null {
  const { t } = useI18n();
  const query = useUserActivity(userId, {}, 5);
  const items = query.data?.pages[0]?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.overview.recentActivity")}</CardTitle>
        <CardAction>
          <Link
            href={userSectionHref(userId, "history")}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("userCard.overview.allActivity")}
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <DetailSkeleton />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("activity.empty.title")}
          </p>
        ) : (
          <ActivityFeed items={items} />
        )}
      </CardContent>
    </Card>
  );
}

export function UserOverview({ userId }: { userId: string }): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const query = useUserOverview(userId);

  if (query.isLoading) return <DetailSkeleton />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  const overview = query.data;
  const { activePlan, week, lastWorkout, lastSession } = overview;
  const weekPercent =
    week && week.plannedKm > 0
      ? Math.min(100, Math.round((week.doneKm / week.plannedKm) * 100))
      : 0;

  return (
    <div className="flex flex-col gap-4">
      {overview.attention.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("userCard.overview.attention")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ItemGroup className="gap-2">
              {overview.attention.map((item, index) => {
                const Icon = ATTENTION_ICONS[item.code];
                return (
                  <Item
                    key={`${item.code}-${item.entityId ?? index}`}
                    variant="outline"
                    size="sm"
                    render={<Link href={attentionHref(userId, item)} />}
                  >
                    <ItemMedia variant="icon">
                      <Icon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        {t(`userCard.overview.attentionCodes.${item.code}`, {
                          count: item.count ?? 0,
                          days: item.days ?? 0,
                          name: item.name ?? "",
                          distance: formatKm(item.distanceKm, locale),
                          limit: formatKm(item.limitKm, locale),
                          provider: item.provider ?? "",
                        })}
                      </ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <ChevronRightIcon className="size-4 text-muted-foreground" />
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title={t("userCard.overview.activePlan")}
          value={
            activePlan ? (
              <Link
                href={`/users/${userId}/plans/${activePlan.id}`}
                className="hover:underline"
              >
                {activePlan.name ?? t("userCard.overview.planWithoutName")}
              </Link>
            ) : (
              t("userCard.overview.noPlan")
            )
          }
          hint={
            activePlan
              ? t("userCard.overview.planWeek", {
                  current: activePlan.currentWeek,
                  total: activePlan.totalWeeks,
                })
              : undefined
          }
        />
        <StatCard
          title={t("userCard.overview.thisWeek")}
          value={
            week
              ? t("userCard.overview.weekKm", {
                  done: formatKm(week.doneKm, locale),
                  planned: formatKm(week.plannedKm, locale),
                })
              : "—"
          }
          hint={
            week
              ? t("userCard.overview.weekWorkouts", {
                  done: week.doneWorkouts,
                  planned: week.plannedWorkouts,
                })
              : undefined
          }
        >
          {week ? <Progress value={weekPercent} /> : null}
        </StatCard>
        <StatCard
          title={t("userCard.overview.lastWorkout")}
          value={
            lastWorkout ? (
              <Link
                href={`/users/${userId}/workouts/${lastWorkout.id}`}
                className="hover:underline"
              >
                {t("userCard.overview.km", {
                  value: formatKm(
                    lastWorkout.actualDistanceKm ?? lastWorkout.distanceKm,
                    locale,
                  ),
                })}
              </Link>
            ) : (
              "—"
            )
          }
          hint={
            lastWorkout
              ? `${formatShortDate(lastWorkout.completedAt ?? lastWorkout.scheduledAt, locale)} · ${t("userCard.overview.pace", { value: formatPaceSeconds(lastWorkout.actualPaceSecondsPerKm) })}`
              : undefined
          }
        />
        <StatCard
          title={t("userCard.overview.lastSession")}
          value={
            lastSession ? formatDate(lastSession.lastActiveAt, locale) : "—"
          }
          hint={
            lastSession
              ? [
                  lastSession.deviceName,
                  lastSession.platform,
                  lastSession.appVersion,
                ]
                  .filter(Boolean)
                  .join(" · ") || undefined
              : undefined
          }
        />
      </div>

      {hasPermission("training.userprogress.read") && overview.hasAthlete ? (
        <WeeklyVolume userId={userId} />
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("userCard.overview.upcoming")}</CardTitle>
            {hasPermission("training.calendar.read") ? (
              <CardAction>
                <Link
                  href={userSectionHref(userId, "calendar")}
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  {t("userCard.sections.calendar.title")}
                </Link>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {!overview.hasAthlete ? (
              <p className="text-sm text-muted-foreground">
                {t("trainingCalendar.noAthleteProfile")}
              </p>
            ) : overview.upcomingWorkouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("userCard.overview.noUpcoming")}
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {overview.upcomingWorkouts.map((workout) => (
                  <WorkoutLine
                    key={workout.id}
                    userId={userId}
                    workout={workout}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("userCard.overview.connections")}</CardTitle>
          </CardHeader>
          <CardContent>
            {overview.connections.length === 0 ? (
              <EmptyState
                title={t("userCard.overview.noConnections")}
                description=" "
              />
            ) : (
              <ItemGroup className="gap-1">
                {overview.connections.map((connection) => (
                  <Item key={connection.key} size="sm">
                    <ItemMedia variant="icon">
                      {connection.key === "coach" ? (
                        <SparklesIcon />
                      ) : (
                        <PlugIcon />
                      )}
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        {t(`userCard.providers.${connection.key}`)}
                      </ItemTitle>
                    </ItemContent>
                    <ItemActions>
                      <Badge
                        variant={
                          connection.status === "connected" ||
                          connection.status === "enabled"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {t(`userCard.connectionStatuses.${connection.status}`)}
                      </Badge>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            )}
          </CardContent>
        </Card>
      </div>

      {hasPermission("users.activity.read") ? (
        <RecentActivity userId={userId} />
      ) : null}
    </div>
  );
}
