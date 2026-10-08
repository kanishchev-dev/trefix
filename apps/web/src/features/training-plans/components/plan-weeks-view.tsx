"use client";

import type { ReactElement } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { Button } from "@workspace/ui/components/button";
import { PencilIcon, PlusIcon } from "lucide-react";

import type { WorkoutStatus } from "@workspace/api-client";

import { WorkoutStatusBadge } from "@/features/training-calendar/components/workout-status-badge";
import { useI18n } from "@/shared/i18n";

import { formatNumber, formatPlanDate } from "../lib/plan-format";
import type {
  DatedWorkoutView,
  DraftWorkoutView,
  PlanWeekView,
} from "../lib/plan-weeks";

const KNOWN_STATUSES: readonly string[] = [
  "planned",
  "completed",
  "skipped",
  "cancelled",
];

/**
 * Weeks of a plan with their workouts. Draft workouts sit on weekdays,
 * started plans on dates; `canEdit` decides per workout whether the edit
 * action is offered, `onAdd` per week whether workouts can be added.
 */
export function PlanWeeksView({
  weeks,
  defaultOpenWeek,
  canEdit,
  onEdit,
  onAdd,
}: {
  weeks: readonly PlanWeekView[];
  defaultOpenWeek?: number;
  canEdit: (workout: DraftWorkoutView | DatedWorkoutView) => boolean;
  onEdit: (
    week: PlanWeekView,
    workout: DraftWorkoutView | DatedWorkoutView,
  ) => void;
  onAdd?: (week: PlanWeekView) => void;
}): ReactElement {
  const { t, locale } = useI18n();

  return (
    <Accordion
      multiple
      defaultValue={defaultOpenWeek !== undefined ? [defaultOpenWeek] : []}
    >
      {weeks.map((week) => (
        <AccordionItem key={week.weekNumber} value={week.weekNumber}>
          <AccordionTrigger className="px-3">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">
                {t("userPlans.weeks.week", { number: week.weekNumber })}
              </span>
              <span className="text-sm font-normal text-muted-foreground">
                {[
                  week.phase
                    ? t(`userPlans.phases.${week.phase.toLowerCase()}`)
                    : null,
                  t("userPlans.weeks.summary", {
                    count: week.workouts.length,
                    distance: formatNumber(week.distanceKm, locale),
                  }),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            {week.workouts.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                {t("userPlans.weeks.empty")}
              </p>
            ) : (
              <ul className="flex flex-col divide-y">
                {week.workouts.map((workout) => {
                  const id =
                    workout.kind === "dated" ? workout.id : workout.key;
                  const when =
                    workout.kind === "dated"
                      ? formatPlanDate(
                          workout.scheduledAt.slice(0, 10),
                          locale,
                          { weekday: "short", day: "numeric", month: "short" },
                        )
                      : t(`userPlans.weekdays.long.${workout.dayOfWeek}`);

                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between gap-4 py-2.5"
                    >
                      <div className="flex min-w-0 items-baseline gap-4">
                        <span className="w-28 shrink-0 text-sm text-muted-foreground first-letter:uppercase">
                          {when}
                        </span>
                        <div className="flex min-w-0 flex-col gap-1">
                          <span className="text-sm font-medium">
                            {t(`trainingCalendar.types.${workout.type}`)}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {t("userPlans.weeks.workoutMetrics", {
                              distance: formatNumber(
                                workout.distanceKm,
                                locale,
                              ),
                              duration: Math.round(workout.durationMinutes),
                            })}
                          </span>
                        </div>
                        {workout.kind === "dated" &&
                        KNOWN_STATUSES.includes(workout.status) ? (
                          <WorkoutStatusBadge
                            status={workout.status as WorkoutStatus}
                          />
                        ) : null}
                      </div>
                      {canEdit(workout) ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("userPlans.workout.editTitle")}
                          onClick={() => onEdit(week, workout)}
                        >
                          <PencilIcon />
                        </Button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
            {onAdd ? (
              <Button
                variant="ghost"
                size="sm"
                className="mt-1"
                onClick={() => onAdd(week)}
              >
                <PlusIcon />
                {t("userPlans.workout.addTitle")}
              </Button>
            ) : null}
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
