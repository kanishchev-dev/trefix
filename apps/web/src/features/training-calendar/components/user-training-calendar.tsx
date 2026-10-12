"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type ReactElement } from "react";

import { Button } from "@trefix/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import { Skeleton } from "@trefix/ui/components/skeleton";
import { CalendarCheckIcon, InfoIcon, PlusIcon } from "lucide-react";

import type { AdminCalendarWorkout } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/shared/i18n";
import { EmptyState, ErrorState } from "@/widgets/data-state";

import {
  useCalendarDay,
  useCalendarSummary,
} from "../hooks/use-training-calendar";
import {
  getBrowserTimezone,
  getMonthGridRange,
  parseDateKey,
  startOfMonth,
  toDateKey,
} from "../lib/calendar-dates";
import { WorkoutCalendar } from "./workout-calendar";
import { WorkoutDayList } from "./workout-day-list";
import {
  WorkoutFormDialog,
  type WorkoutDialogState,
} from "./workout-form-dialog";

/** Query parameter holding the selected day, so a reload or a shared link opens the same day. */
export const TRAINING_CALENDAR_DATE_PARAM = "date";

/**
 * Admin view of a user's workout calendar: pick a day in the month grid, see
 * that day's workouts, add a new one or edit a planned one.
 */
export function UserTrainingCalendar({
  userId,
}: {
  userId: string;
}): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const timezone = useMemo(() => getBrowserTimezone(), []);
  const canManage = hasPermission("training.calendar.manage");

  const selectedDay = useMemo(
    () =>
      parseDateKey(searchParams.get(TRAINING_CALENDAR_DATE_PARAM)) ??
      new Date(),
    [searchParams],
  );
  const selectedKey = toDateKey(selectedDay);

  const [month, setMonth] = useState<Date>(() => startOfMonth(selectedDay));
  const [dialog, setDialog] = useState<WorkoutDialogState | null>(null);

  const range = useMemo(() => getMonthGridRange(month), [month]);
  const summaryQuery = useCalendarSummary(userId, { ...range, timezone });
  const dayQuery = useCalendarDay(userId, { date: selectedKey, timezone });

  const busyDays = useMemo(
    () =>
      (summaryQuery.data?.days ?? [])
        .map((day) => parseDateKey(day.date))
        .filter((day): day is Date => day !== null),
    [summaryQuery.data],
  );

  const selectDay = (day: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(TRAINING_CALENDAR_DATE_PARAM, toDateKey(day));
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    setMonth(startOfMonth(day));
  };

  const handleSaved = (workout: AdminCalendarWorkout) => {
    setDialog(null);
    // An edit may move the workout to another day: follow it so the admin sees the result.
    selectDay(new Date(workout.scheduledAt));
  };

  const day = dayQuery.data;
  const hasAthleteProfile = day?.hasAthleteProfile ?? true;
  const dayTitle = new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(selectedDay);

  return (
    <div className="flex flex-col gap-4">
      {!hasAthleteProfile ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <InfoIcon className="size-4 shrink-0" />
          {t("trainingCalendar.noAthleteProfile")}
        </p>
      ) : null}

      <div className="grid items-start gap-4 lg:grid-cols-[auto_minmax(0,1fr)]">
        <Card>
          <CardContent>
            <WorkoutCalendar
              locale={locale}
              selected={selectedDay}
              onSelect={selectDay}
              month={month}
              onMonthChange={setMonth}
              busyDays={busyDays}
            />
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {t("trainingCalendar.timezoneHint", { timezone })}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="first-letter:uppercase">{dayTitle}</CardTitle>
            <CardDescription>
              {day
                ? t("trainingCalendar.list.count", { count: day.total })
                : t("common.states.loading")}
            </CardDescription>
            {canManage && hasAthleteProfile ? (
              <CardAction>
                <Button
                  size="sm"
                  onClick={() =>
                    setDialog({ mode: "create", day: selectedDay })
                  }
                >
                  <PlusIcon />
                  {t("trainingCalendar.actions.add")}
                </Button>
              </CardAction>
            ) : null}
          </CardHeader>
          <CardContent>
            {dayQuery.isLoading ? (
              <div className="flex flex-col gap-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : dayQuery.isError || !day ? (
              <ErrorState onRetry={() => dayQuery.refetch()} />
            ) : day.workouts.length === 0 ? (
              <EmptyState
                title={t("trainingCalendar.empty.title")}
                description={
                  canManage && hasAthleteProfile
                    ? t("trainingCalendar.empty.description")
                    : t("trainingCalendar.empty.readOnlyDescription")
                }
              />
            ) : (
              <WorkoutDayList
                workouts={day.workouts}
                canManage={canManage}
                onEdit={(workout) => setDialog({ mode: "edit", workout })}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {summaryQuery.isError ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <CalendarCheckIcon className="size-4 shrink-0" />
          {t("trainingCalendar.summaryError")}
        </p>
      ) : null}

      {canManage ? (
        <WorkoutFormDialog
          userId={userId}
          state={dialog}
          onOpenChange={(open) => {
            if (!open) {
              setDialog(null);
            }
          }}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
