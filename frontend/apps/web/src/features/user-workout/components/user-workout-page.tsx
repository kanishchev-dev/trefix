"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button, buttonVariants } from "@trefix/ui/components/button";
import { ButtonGroup } from "@trefix/ui/components/button-group";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@trefix/ui/components/table";
import {
  ArrowLeftIcon,
  CheckIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RotateCcwIcon,
  Trash2Icon,
  TrophyIcon,
} from "lucide-react";

import type { TrainingWorkout } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { ActivityList } from "@/features/activity/components/activity-list";
import { useUserActivity } from "@/features/activity/hooks/use-activity";
import { WorkoutStatusBadge } from "@/features/training-calendar/components/workout-status-badge";
import { toDateKey } from "@/features/training-calendar/lib/calendar-dates";
import { isNotFound } from "@/features/users/lib/card-errors";
import { formatKm, formatPaceSeconds } from "@/features/users/lib/card-format";
import { formatDate, useI18n } from "@/shared/i18n";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { DetailSkeleton, EmptyState, ErrorState } from "@/widgets/data-state";

import { useAdminWorkout, useWorkoutActions } from "../hooks/use-admin-workout";
import {
  WorkoutGearCard,
  WorkoutNoteCard,
  WorkoutSourcesCard,
} from "./workout-side-cards";
import { WorkoutResultDialog } from "./workout-result-dialog";

type Dialog = "complete" | "edit" | "reopen" | "delete" | null;

const numberOf = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function PlanFactCard({ workout }: { workout: TrainingWorkout }): ReactElement {
  const { t, locale } = useI18n();
  const actual = workout.actual ?? {};
  const km = (value: number | null) =>
    value === null
      ? "—"
      : t("userCard.overview.km", { value: formatKm(value, locale) });
  const minutes = (value: number | null) =>
    value === null
      ? "—"
      : t("userCard.workout.minutes", { value: Math.round(value) });
  const targetPace = numberOf(workout.target.paceSecondsPerKm);

  const rows: { key: string; planned: string; actual: string }[] = [
    {
      key: "distance",
      planned: km(workout.distanceKm),
      actual: km(numberOf(actual.actualDistanceKm)),
    },
    {
      key: "duration",
      planned: minutes(workout.durationMinutes),
      actual: minutes(numberOf(actual.actualDurationMinutes)),
    },
    {
      key: "pace",
      planned: formatPaceSeconds(targetPace),
      actual: formatPaceSeconds(numberOf(actual.actualAveragePaceSecondsPerKm)),
    },
    {
      key: "heartRate",
      planned: "—",
      actual: numberOf(actual.actualAverageHeartRate)?.toString() ?? "—",
    },
    {
      key: "rpe",
      planned: "—",
      actual: numberOf(actual.rpe)?.toString() ?? "—",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.workout.planFact.title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead />
              <TableHead>{t("userCard.workout.planFact.planned")}</TableHead>
              <TableHead>{t("userCard.workout.planFact.actual")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="text-muted-foreground">
                  {t(`userCard.workout.result.${row.key}`)}
                </TableCell>
                <TableCell className="tabular-nums">{row.planned}</TableCell>
                <TableCell className="tabular-nums font-medium">
                  {row.actual}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {typeof actual.notes === "string" && actual.notes ? (
          <p className="rounded-lg border p-3 text-sm whitespace-pre-wrap">
            {actual.notes}
          </p>
        ) : null}
        {workout.analysis ? (
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">
              {t("userCard.workout.analysis.completion", {
                value: Math.round(workout.analysis.completion * 100),
              })}
            </Badge>
            <Badge variant="outline">
              {t("userCard.workout.analysis.load", {
                value: Math.round(workout.analysis.load),
                expected: Math.round(workout.analysis.expectedLoad),
              })}
            </Badge>
            <Badge variant="outline">
              {t(
                `userCard.workout.analysis.fatigue.${workout.analysis.fatigueImpact}`,
              )}
            </Badge>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function WorkoutHistory({
  userId,
  workoutId,
}: {
  userId: string;
  workoutId: string;
}): ReactElement {
  const { t } = useI18n();
  const filter = useMemo(
    () => ({ entityType: "workout", entityId: workoutId }),
    [workoutId],
  );
  const query = useUserActivity(userId, filter);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.workout.history")}</CardTitle>
      </CardHeader>
      <CardContent>
        <ActivityList query={query} />
      </CardContent>
    </Card>
  );
}

export function UserWorkoutPage({
  userId,
  workoutId,
}: {
  userId: string;
  workoutId: string;
}): ReactElement {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { hasPermission } = useAuth();
  const query = useAdminWorkout(userId, workoutId);
  const actions = useWorkoutActions(userId, workoutId);
  const [dialog, setDialog] = useState<Dialog>(null);

  if (query.isLoading) return <DetailSkeleton />;
  if (isNotFound(query.error)) {
    return (
      <EmptyState
        title={t("userCard.workout.notFound.title")}
        description={t("userCard.workout.notFound.description")}
      />
    );
  }
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  const workout = query.data;

  const canManage = hasPermission("training.calendar.manage");
  const calendarHref = `/users/${userId}/calendar?date=${toDateKey(new Date(workout.scheduledAt))}`;
  const isCompleted = workout.status === "completed";
  const canComplete =
    workout.status === "planned" || workout.status === "skipped";
  const close = () => setDialog(null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href={calendarHref}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeftIcon className="size-4" />
            {t("userCard.sections.calendar.title")}
          </Link>
          <h2 className="text-xl font-medium">
            {typeof workout.target.title === "string" && workout.target.title
              ? workout.target.title
              : t(`trainingCalendar.types.${workout.type}`)}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>{formatDate(workout.scheduledAt, locale)}</span>
            <WorkoutStatusBadge status={workout.status} />
            {workout.planId ? (
              <Link
                href={`/users/${userId}/plans/${workout.planId}`}
                className={buttonVariants({ variant: "link", size: "sm" })}
              >
                {t("userCard.workout.planWeek", { week: workout.weekNumber })}
              </Link>
            ) : null}
            {workout.completedAt ? (
              <span>
                {t("userCard.workout.completedAt", {
                  date: formatDate(workout.completedAt, locale),
                })}
              </span>
            ) : null}
          </div>
        </div>

        {canManage ? (
          <ButtonGroup>
            {canComplete ? (
              <Button size="sm" onClick={() => setDialog("complete")}>
                <CheckIcon />
                {t("userCard.workout.actions.complete")}
              </Button>
            ) : null}
            {isCompleted ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDialog("edit")}
              >
                <PencilIcon />
                {t("userCard.workout.actions.editResult")}
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
                {isCompleted ? (
                  <DropdownMenuItem onClick={() => setDialog("reopen")}>
                    <RotateCcwIcon />
                    {t("userCard.workout.actions.reopen")}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={() => actions.setRecordsExcluded.mutate(true)}
                >
                  <TrophyIcon />
                  {t("userCard.workout.actions.excludeRecords")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => actions.setRecordsExcluded.mutate(false)}
                >
                  <TrophyIcon />
                  {t("userCard.workout.actions.includeRecords")}
                </DropdownMenuItem>
                {!workout.planId ? (
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
          </ButtonGroup>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <PlanFactCard workout={workout} />
          <WorkoutSourcesCard
            userId={userId}
            workoutId={workout.id}
            canManage={canManage}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {hasPermission("training.usergear.read") ? (
            <WorkoutGearCard
              userId={userId}
              workout={workout}
              canManage={canManage}
            />
          ) : null}
          {hasPermission("coach.users.read") ? (
            <WorkoutNoteCard
              userId={userId}
              workoutId={workout.id}
              canManage={hasPermission("coach.users.manage")}
            />
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle>{t("userCard.workout.details")}</CardTitle>
              <CardDescription>
                {t("userCard.workout.phase", { phase: workout.phase })}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              <span className="font-mono break-all">{workout.id}</span>
            </CardContent>
          </Card>
        </div>
      </div>

      {hasPermission("users.activity.read") ? (
        <WorkoutHistory userId={userId} workoutId={workout.id} />
      ) : null}

      <WorkoutResultDialog
        workout={workout}
        mode={dialog === "edit" ? "edit" : "complete"}
        open={dialog === "complete" || dialog === "edit"}
        onOpenChange={(open) => !open && close()}
        isPending={actions.complete.isPending || actions.updateResult.isPending}
        onSubmit={(input) =>
          dialog === "edit"
            ? actions.updateResult.mutate(input, { onSuccess: close })
            : actions.complete.mutate(input, { onSuccess: close })
        }
      />
      <ConfirmDialog
        open={dialog === "reopen"}
        onOpenChange={(open) => !open && close()}
        destructive={false}
        title={t("userCard.workout.reopenTitle")}
        description={t("userCard.workout.reopenDescription")}
        confirmLabel={t("userCard.workout.actions.reopen")}
        isPending={actions.reopen.isPending}
        onConfirm={() => actions.reopen.mutate(undefined, { onSuccess: close })}
      />
      <ConfirmDialog
        open={dialog === "delete"}
        onOpenChange={(open) => !open && close()}
        title={t("userCard.workout.deleteTitle")}
        description={t("userCard.workout.deleteDescription")}
        confirmLabel={t("common.actions.delete")}
        isPending={actions.remove.isPending}
        onConfirm={() =>
          actions.remove.mutate(undefined, {
            onSuccess: () => router.push(calendarHref),
          })
        }
      />
    </div>
  );
}
