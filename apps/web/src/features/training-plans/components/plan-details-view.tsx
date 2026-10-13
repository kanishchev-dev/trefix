"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactElement } from "react";

import { Button } from "@trefix/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@trefix/ui/components/dropdown-menu";
import {
  ArrowLeftIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlayIcon,
  RotateCcwIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";

import type { PlanDetails } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import {
  getBrowserTimezone,
  toDateKey,
} from "@/features/training-calendar/lib/calendar-dates";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import { ConfirmDialog } from "@/widgets/confirm-dialog";

import { useCancelPlan, useDeletePlan } from "../hooks/use-user-plans";
import { formatNumber, formatPlanDate } from "../lib/plan-format";
import { planTitle } from "../lib/plan-texts";
import {
  buildPlanWeeks,
  isDatedWorkoutEditable,
  workoutDateKey,
} from "../lib/plan-weeks";
import {
  ActiveWorkoutDialog,
  type ActiveWorkoutDialogState,
} from "./active-workout-dialog";
import {
  DraftWorkoutDialog,
  type DraftWorkoutDialogState,
} from "./draft-workout-dialog";
import { GoalDateDialog } from "./goal-date-dialog";
import { PlanInfo } from "./plan-info";
import { PlanMetaDialog } from "./plan-meta-dialog";
import { PlanStartDialog } from "./plan-start-dialog";
import { PlanStatusBadge } from "./plan-status-badge";
import { PlanWeeksView } from "./plan-weeks-view";
import { ScheduleChangeDialog } from "./schedule-change-dialog";

type PlanDialog =
  | "meta"
  | "start"
  | "cancel"
  | "delete"
  | "schedule"
  | "goalDate"
  | null;

const HISTORY_STATUSES: readonly string[] = ["completed", "cancelled"];

/** One plan of a user in the admin panel: parameters, weeks and every action the status allows. */
export function PlanDetailsView({
  userId,
  plan,
}: {
  userId: string;
  plan: PlanDetails;
}): ReactElement {
  const { t, locale } = useI18n();
  const title = planTitle(plan, t, locale);
  const router = useRouter();
  const { hasPermission } = useAuth();
  const canManage = hasPermission("training.userplans.manage");

  const [dialog, setDialog] = useState<PlanDialog>(null);
  const [draftWorkout, setDraftWorkout] =
    useState<DraftWorkoutDialogState | null>(null);
  const [activeWorkout, setActiveWorkout] =
    useState<ActiveWorkoutDialogState | null>(null);

  const cancelPlan = useCancelPlan(userId, plan.id);
  const deletePlan = useDeletePlan(userId);

  const isDraft = plan.status === "draft";
  const isActive = plan.status === "active";
  const isHistory = HISTORY_STATUSES.includes(plan.status);
  const todayKey = toDateKey(new Date());
  const backHref = `/users/${userId}?tab=plans&group=${isDraft ? "draft" : isActive ? "active" : "history"}`;

  const weeks = useMemo(() => buildPlanWeeks(plan), [plan]);
  const describeWorkout = useMemo(() => {
    const labels = new Map<string, string>();
    for (const workout of plan.workouts) {
      labels.set(
        workout.id,
        `${formatPlanDate(workoutDateKey(workout), locale, { weekday: "short", day: "numeric", month: "short" })} · ${t(
          `trainingCalendar.types.${workout.type}`,
        )} ${formatNumber(workout.distanceKm, locale)} ${t("userPlans.units.km")}`,
      );
    }
    return (key: string) => labels.get(key);
  }, [plan.workouts, locale, t]);

  const onError = (error: unknown) =>
    notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));

  const dates =
    plan.startDate && plan.endDate
      ? `${formatPlanDate(plan.startDate, locale)} — ${formatPlanDate(plan.endDate, locale)}`
      : t("userPlans.list.notStarted");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-fit"
            render={<Link href={backHref} />}
          >
            <ArrowLeftIcon />
            {t("userPlans.actions.backToPlans")}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <PlanStatusBadge status={plan.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            {[
              dates,
              t("userPlans.list.weeks", { count: plan.totalWeeks }),
              isActive && plan.currentWeek
                ? t("userPlans.list.currentWeek", {
                    week: plan.currentWeek,
                    total: plan.totalWeeks,
                  })
                : null,
              plan.stats
                ? t("userPlans.list.stats", {
                    completed: plan.stats.completedWorkouts,
                    planned: plan.stats.plannedWorkouts,
                    distance: formatNumber(plan.stats.totalDistanceKm, locale),
                  })
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap items-center gap-2">
            {isDraft ? (
              <Button size="sm" onClick={() => setDialog("start")}>
                <PlayIcon />
                {t("userPlans.actions.start")}
              </Button>
            ) : null}
            {isHistory || isDraft ? (
              <Button
                variant="outline"
                size="sm"
                render={
                  <Link href={`/users/${userId}/plans/${plan.id}/rebuild`} />
                }
              >
                <RotateCcwIcon />
                {t("userPlans.actions.rebuild")}
              </Button>
            ) : null}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon-sm"
                    aria-label={t("common.table.actions")}
                  />
                }
              >
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setDialog("meta")}>
                  <PencilIcon />
                  {t("userPlans.actions.editMeta")}
                </DropdownMenuItem>
                {isActive ? (
                  <>
                    <DropdownMenuItem onClick={() => setDialog("schedule")}>
                      <CalendarDaysIcon />
                      {t("userPlans.actions.changeSchedule")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setDialog("goalDate")}>
                      <CalendarClockIcon />
                      {t("userPlans.actions.changeGoalDate")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDialog("cancel")}
                    >
                      <XCircleIcon />
                      {t("userPlans.actions.cancel")}
                    </DropdownMenuItem>
                  </>
                ) : null}
                {isDraft || isHistory ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDialog("delete")}
                    >
                      <Trash2Icon />
                      {t("common.actions.delete")}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      <PlanInfo userId={userId} plan={plan} />

      <Card>
        <CardHeader>
          <CardTitle>{t("userPlans.weeks.title")}</CardTitle>
          <CardDescription>
            {isDraft
              ? t("userPlans.weeks.draftHint")
              : isActive
                ? t("userPlans.weeks.activeHint")
                : t("userPlans.weeks.historyHint")}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3">
          <PlanWeeksView
            weeks={weeks}
            defaultOpenWeek={isActive ? plan.currentWeek : weeks[0]?.weekNumber}
            canEdit={(workout) =>
              canManage &&
              ((workout.kind === "relative" && isDraft) ||
                (workout.kind === "dated" &&
                  isActive &&
                  isDatedWorkoutEditable(workout, todayKey)))
            }
            onEdit={(week, workout) => {
              if (workout.kind === "relative") {
                setDraftWorkout({
                  mode: "edit",
                  weekNumber: week.weekNumber,
                  workout,
                });
              } else {
                setActiveWorkout({ mode: "edit", workout });
              }
            }}
            onAdd={
              canManage && (isDraft || isActive)
                ? (week) => {
                    if (isDraft) {
                      setDraftWorkout({
                        mode: "add",
                        weekNumber: week.weekNumber,
                      });
                      return;
                    }
                    const firstDate = week.workouts.find(
                      (workout) => workout.kind === "dated",
                    );
                    const date =
                      firstDate?.kind === "dated"
                        ? workoutDateKey(firstDate)
                        : undefined;
                    setActiveWorkout({
                      mode: "add",
                      date: date && date > todayKey ? date : todayKey,
                    });
                  }
                : undefined
            }
          />
        </CardContent>
      </Card>

      {canManage ? (
        <>
          <PlanMetaDialog
            userId={userId}
            plan={plan}
            open={dialog === "meta"}
            onOpenChange={(open) => setDialog(open ? "meta" : null)}
          />
          {isDraft ? (
            <>
              <PlanStartDialog
                userId={userId}
                plan={plan}
                open={dialog === "start"}
                onOpenChange={(open) => setDialog(open ? "start" : null)}
              />
              <DraftWorkoutDialog
                userId={userId}
                plan={plan}
                state={draftWorkout}
                onClose={() => setDraftWorkout(null)}
              />
            </>
          ) : null}
          {isActive ? (
            <>
              <ScheduleChangeDialog
                userId={userId}
                plan={plan}
                open={dialog === "schedule"}
                onOpenChange={(open) => setDialog(open ? "schedule" : null)}
              />
              <GoalDateDialog
                userId={userId}
                plan={plan}
                open={dialog === "goalDate"}
                onOpenChange={(open) => setDialog(open ? "goalDate" : null)}
              />
              <ActiveWorkoutDialog
                userId={userId}
                plan={plan}
                state={activeWorkout}
                onClose={() => setActiveWorkout(null)}
                describe={describeWorkout}
              />
            </>
          ) : null}
          <ConfirmDialog
            open={dialog === "cancel"}
            onOpenChange={(open) => setDialog(open ? "cancel" : null)}
            title={t("userPlans.cancel.title")}
            description={t("userPlans.cancel.description", { name: title })}
            confirmLabel={t("userPlans.actions.cancel")}
            isPending={cancelPlan.isPending}
            onConfirm={() =>
              cancelPlan.mutate(getBrowserTimezone(), {
                onSuccess: (result) => {
                  setDialog(null);
                  notifySuccess(
                    t("userPlans.toasts.cancelled", {
                      count: result.cancelledWorkouts,
                    }),
                  );
                },
                onError,
              })
            }
          />
          <ConfirmDialog
            open={dialog === "delete"}
            onOpenChange={(open) => setDialog(open ? "delete" : null)}
            title={t("userPlans.delete.title")}
            description={t("userPlans.delete.description", { name: title })}
            confirmLabel={t("common.actions.delete")}
            isPending={deletePlan.isPending}
            onConfirm={() =>
              deletePlan.mutate(plan.id, {
                onSuccess: () => {
                  setDialog(null);
                  notifySuccess(t("userPlans.toasts.deleted"));
                  router.push(backHref);
                },
                onError,
              })
            }
          />
        </>
      ) : null}
    </div>
  );
}
