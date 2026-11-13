"use client";

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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@trefix/ui/components/item";
import {
  DatabaseIcon,
  EyeIcon,
  RefreshCwIcon,
  Trash2Icon,
  UnlinkIcon,
} from "lucide-react";

import type { TrainingWorkout } from "@trefix/api-client";

import { useUserGear } from "@/features/user-athlete/hooks/use-user-athlete";
import { DetailRow } from "@/features/users/components/card/detail-row";
import { SplitsChart } from "@/features/users/components/charts/card-charts";
import { formatKm, formatPaceSeconds } from "@/features/users/lib/card-format";
import { formatDate, useI18n } from "@/shared/i18n";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { DetailSkeleton, ErrorState } from "@/widgets/data-state";
import { OptionSelect } from "@/widgets/option-select";

import {
  useWorkoutActions,
  useWorkoutNote,
  useWorkoutRecording,
  useWorkoutSources,
} from "../hooks/use-admin-workout";

const NO_GEAR = "none";

export function WorkoutSourcesCard({
  userId,
  workoutId,
  canManage,
}: {
  userId: string;
  workoutId: string;
  canManage: boolean;
}): ReactElement {
  const { t, locale } = useI18n();
  const sources = useWorkoutSources(userId, workoutId, true);
  const [showRecording, setShowRecording] = useState(false);
  const recording = useWorkoutRecording(userId, workoutId, showRecording);
  const { unlinkSource } = useWorkoutActions(userId, workoutId);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const items = sources.data?.items ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.workout.sources.title")}</CardTitle>
        <CardDescription>
          {t("userCard.workout.sources.description")}
        </CardDescription>
        {!showRecording ? (
          <CardAction>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRecording(true)}
            >
              <EyeIcon />
              {t("userCard.workout.sources.showRecording")}
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sources.isLoading ? (
          <DetailSkeleton />
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("userCard.workout.sources.empty")}
          </p>
        ) : (
          <ItemGroup className="gap-2">
            {items.map((source) => (
              <Item key={source.provider} variant="outline" size="sm">
                <ItemMedia variant="icon">
                  <DatabaseIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {t(`userCard.providers.${source.provider}`)}
                    {source.isPrimary ? (
                      <Badge variant="outline">
                        {t("userCard.workout.sources.primary")}
                      </Badge>
                    ) : null}
                  </ItemTitle>
                  <ItemDescription>
                    {[source.originDevice, formatDate(source.startedAt, locale)]
                      .filter(Boolean)
                      .join(" · ")}
                  </ItemDescription>
                </ItemContent>
                {canManage ? (
                  <ItemActions>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("userCard.workout.sources.unlink")}
                      onClick={() => setUnlinking(source.provider)}
                    >
                      <UnlinkIcon />
                    </Button>
                  </ItemActions>
                ) : null}
              </Item>
            ))}
          </ItemGroup>
        )}
        {showRecording ? (
          recording.isLoading ? (
            <DetailSkeleton />
          ) : recording.isError || !recording.data ? (
            <p className="text-sm text-muted-foreground">
              {t("userCard.workout.sources.noRecording")}
            </p>
          ) : (
            <div className="flex flex-col gap-2 rounded-xl border p-3">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <EyeIcon className="size-3.5" />
                {t("userCard.coach.accessLogged")}
              </p>
              <div className="grid gap-x-6 sm:grid-cols-3">
                <DetailRow
                  label={t("userCard.workout.recording.distance")}
                  value={t("userCard.overview.km", {
                    value: formatKm(recording.data.distanceM / 1000, locale),
                  })}
                />
                <DetailRow
                  label={t("userCard.workout.recording.moving")}
                  value={t("userCard.workout.minutes", {
                    value: Math.round(recording.data.movingSec / 60),
                  })}
                />
                <DetailRow
                  label={t("userCard.workout.recording.pace")}
                  value={formatPaceSeconds(recording.data.avgPaceSecPerKm)}
                />
                <DetailRow
                  label={t("userCard.workout.recording.heartRate")}
                  value={
                    recording.data.avgHeartRate
                      ? `${recording.data.avgHeartRate} / ${recording.data.maxHeartRate ?? "—"}`
                      : "—"
                  }
                />
                <DetailRow
                  label={t("userCard.workout.recording.elevation")}
                  value={recording.data.elevationGainM ?? "—"}
                />
                <DetailRow
                  label={t("userCard.workout.recording.environment")}
                  value={t(
                    `userCard.workout.recording.environments.${recording.data.environment}`,
                  )}
                />
              </div>
              {recording.data.splits.length > 0 ? (
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-muted-foreground">
                    {t("userCard.workout.recording.splits", {
                      count: recording.data.splits.length,
                    })}
                  </span>
                  <SplitsChart splits={recording.data.splits} />
                </div>
              ) : null}
            </div>
          )
        ) : null}
      </CardContent>
      <ConfirmDialog
        open={unlinking !== null}
        onOpenChange={(open) => !open && setUnlinking(null)}
        title={t("userCard.workout.sources.unlinkTitle")}
        description={t("userCard.workout.sources.unlinkDescription", {
          provider: unlinking ? t(`userCard.providers.${unlinking}`) : "",
        })}
        confirmLabel={t("userCard.workout.sources.unlink")}
        isPending={unlinkSource.isPending}
        onConfirm={() =>
          unlinking &&
          unlinkSource.mutate(unlinking, {
            onSuccess: () => setUnlinking(null),
          })
        }
      />
    </Card>
  );
}

export function WorkoutGearCard({
  userId,
  workout,
  canManage,
}: {
  userId: string;
  workout: TrainingWorkout;
  canManage: boolean;
}): ReactElement {
  const { t } = useI18n();
  const gear = useUserGear(userId, "active");
  const { setGear } = useWorkoutActions(userId, workout.id);
  const current = workout.gearId ?? NO_GEAR;
  const items = gear.data?.items ?? [];
  const known =
    current === NO_GEAR || items.some((item) => item.id === current);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.workout.gear.title")}</CardTitle>
        <CardDescription>
          {t("userCard.workout.gear.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {gear.isLoading ? (
          <DetailSkeleton />
        ) : (
          <OptionSelect
            value={current}
            disabled={!canManage || setGear.isPending}
            options={[
              { value: NO_GEAR, label: t("userCard.workout.gear.none") },
              ...(known
                ? []
                : [
                    {
                      value: current,
                      label: t("userCard.workout.gear.retired"),
                    },
                  ]),
              ...items.map((item) => ({
                value: item.id,
                label: item.nickname || `${item.brand} ${item.model}`.trim(),
              })),
            ]}
            onValueChange={(value) =>
              setGear.mutate(value === NO_GEAR ? null : value)
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

export function WorkoutNoteCard({
  userId,
  workoutId,
  canManage,
}: {
  userId: string;
  workoutId: string;
  canManage: boolean;
}): ReactElement {
  const { t, locale } = useI18n();
  const note = useWorkoutNote(userId, workoutId, true);
  const { regenerateNote, deleteNote } = useWorkoutActions(userId, workoutId);
  const [deleteOpen, setDeleteOpen] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.workout.note.title")}</CardTitle>
        <CardDescription>
          {note.data?.generatedAt
            ? t("userCard.workout.note.generatedAt", {
                date: formatDate(note.data.generatedAt, locale),
              })
            : t("userCard.workout.note.description")}
        </CardDescription>
        {canManage ? (
          <CardAction className="flex gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("userCard.workout.note.regenerate")}
              disabled={regenerateNote.isPending}
              onClick={() => regenerateNote.mutate(undefined)}
            >
              <RefreshCwIcon />
            </Button>
            {note.data?.content ? (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t("common.actions.delete")}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2Icon />
              </Button>
            ) : null}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent>
        {note.isLoading ? (
          <DetailSkeleton />
        ) : note.isError ? (
          <ErrorState onRetry={() => note.refetch()} />
        ) : note.data?.content ? (
          <p className="text-sm whitespace-pre-wrap">{note.data.content}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t(
              `userCard.workout.note.statuses.${note.data?.status ?? "pending"}`,
            )}
          </p>
        )}
      </CardContent>
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("userCard.workout.note.deleteTitle")}
        description={t("userCard.workout.note.deleteDescription")}
        confirmLabel={t("common.actions.delete")}
        isPending={deleteNote.isPending}
        onConfirm={() =>
          deleteNote.mutate(undefined, {
            onSuccess: () => setDeleteOpen(false),
          })
        }
      />
    </Card>
  );
}
