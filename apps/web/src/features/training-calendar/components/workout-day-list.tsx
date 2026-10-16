"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@trefix/ui/components/tooltip";
import { LockIcon, PencilIcon } from "lucide-react";

import type { AdminCalendarWorkout } from "@trefix/api-client";

import { useI18n } from "@/shared/i18n";

import { WorkoutStatusBadge } from "./workout-status-badge";

/** Completed workouts carry an actual result and load: history the admin must not rewrite. */
export function isWorkoutEditable(workout: AdminCalendarWorkout): boolean {
  return workout.status !== "completed" && !workout.hasActual;
}

export function WorkoutDayList({
  workouts,
  canManage,
  onEdit,
  workoutHref,
}: {
  workouts: readonly AdminCalendarWorkout[];
  /** Page of a workout; the title links to it when set. */
  workoutHref?: (workout: AdminCalendarWorkout) => string;
  canManage: boolean;
  onEdit: (workout: AdminCalendarWorkout) => void;
}): ReactElement {
  const { t, locale } = useI18n();

  const timeFormat = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const numberFormat = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 1,
  });

  return (
    <ul className="flex flex-col divide-y">
      {workouts.map((workout) => {
        const editable = isWorkoutEditable(workout);
        const typeLabel = t(`trainingCalendar.types.${workout.type}`);

        return (
          <li
            key={workout.id}
            className="flex items-start justify-between gap-4 py-3"
          >
            <div className="flex min-w-0 gap-4">
              <time
                dateTime={workout.scheduledAt}
                className="w-12 shrink-0 pt-0.5 text-sm font-medium tabular-nums text-muted-foreground"
              >
                {timeFormat.format(new Date(workout.scheduledAt))}
              </time>
              <div className="flex min-w-0 flex-col gap-1">
                {workoutHref ? (
                  <Link
                    href={workoutHref(workout)}
                    className="truncate text-sm font-medium hover:underline"
                  >
                    {workout.title ?? typeLabel}
                  </Link>
                ) : (
                  <span className="truncate text-sm font-medium">
                    {workout.title ?? typeLabel}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">
                  {t("trainingCalendar.list.metrics", {
                    type: typeLabel,
                    distance: numberFormat.format(workout.distanceKm),
                    duration: numberFormat.format(workout.durationMinutes),
                  })}
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  <WorkoutStatusBadge status={workout.status} />
                  {workout.planId ? (
                    <Badge variant="secondary">
                      {t("trainingCalendar.list.fromPlan")}
                    </Badge>
                  ) : null}
                </div>
              </div>
            </div>

            {canManage ? (
              editable ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("trainingCalendar.actions.edit")}
                  onClick={() => onEdit(workout)}
                >
                  <PencilIcon />
                </Button>
              ) : (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <span
                        tabIndex={0}
                        className="flex size-7 shrink-0 items-center justify-center text-muted-foreground"
                        aria-label={t("trainingCalendar.list.lockedHint")}
                      />
                    }
                  >
                    <LockIcon className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("trainingCalendar.list.lockedHint")}
                  </TooltipContent>
                </Tooltip>
              )
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
