"use client";

import { useState, type ReactElement, type ReactNode } from "react";

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
import { Progress } from "@trefix/ui/components/progress";
import { PencilIcon } from "lucide-react";

import type { AthleteProfile } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { DetailRow } from "@/features/users/components/card/detail-row";
import { NoAthlete } from "@/features/users/components/card/no-athlete";
import { isNotFound } from "@/features/users/lib/card-errors";
import { formatKm } from "@/features/users/lib/card-format";
import { formatDate, useI18n } from "@/shared/i18n";
import { DetailSkeleton, ErrorState } from "@/widgets/data-state";

import {
  useUpdateUserAthlete,
  useUserAthlete,
} from "../hooks/use-user-athlete";
import { AthleteEditDialog, WEEKDAYS } from "./athlete-edit-dialog";

function Sourced({
  profile,
  field,
  children,
}: {
  profile: AthleteProfile;
  field: string;
  children: ReactNode;
}): ReactElement {
  const { t } = useI18n();
  const source = profile.fieldSources[field]?.source;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {children}
      {source && source !== "manual" ? (
        <Badge variant="outline">{t(`userCard.providers.${source}`)}</Badge>
      ) : null}
    </span>
  );
}

export function UserAthleteSection({
  userId,
}: {
  userId: string;
}): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const query = useUserAthlete(userId);
  const update = useUpdateUserAthlete(userId);
  const [editOpen, setEditOpen] = useState(false);

  if (query.isLoading) return <DetailSkeleton />;
  if (isNotFound(query.error)) return <NoAthlete />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => query.refetch()} />;
  }

  const profile = query.data;
  const value = (number: number | null, unit: string) =>
    number === null ? "—" : `${formatKm(number, locale)} ${unit}`;
  const label = (key: string) => t(`userCard.athlete.fields.${key}`);
  const days = WEEKDAYS.filter((day) =>
    profile.availableTrainingDays.includes(day),
  )
    .map((day) => t(`userCard.weekdaysShort.${day}`))
    .join(", ");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("userCard.athlete.title")}</CardTitle>
          <CardDescription>
            {t("userCard.athlete.updatedAt", {
              date: formatDate(profile.updatedAt, locale),
            })}
          </CardDescription>
          {hasPermission("training.userathletes.manage") ? (
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <PencilIcon />
                {t("common.actions.edit")}
              </Button>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">
              {t("userCard.athlete.completeness", {
                percent: profile.completeness.percent,
              })}
            </span>
            <Progress value={profile.completeness.percent} />
          </div>
          <div className="grid gap-x-8 md:grid-cols-3">
            <DetailRow
              label={label("birthDate")}
              value={
                <Sourced profile={profile} field="birthDate">
                  {profile.birthDate
                    ? `${profile.birthDate}${profile.age !== null ? ` · ${t("userCard.athlete.age", { age: profile.age })}` : ""}`
                    : "—"}
                </Sourced>
              }
            />
            <DetailRow
              label={label("sex")}
              value={
                <Sourced profile={profile} field="sex">
                  {t(`userCard.athlete.sex.${profile.sex ?? "none"}`)}
                </Sourced>
              }
            />
            <DetailRow
              label={label("heightCm")}
              value={
                <Sourced profile={profile} field="heightCm">
                  {value(profile.heightCm, t("userCard.units.cm"))}
                </Sourced>
              }
            />
            <DetailRow
              label={label("weightKg")}
              value={
                <Sourced profile={profile} field="weightKg">
                  {value(profile.weightKg, t("userCard.units.kg"))}
                </Sourced>
              }
            />
            <DetailRow
              label={label("experienceLevel")}
              value={t(`userCard.athlete.levels.${profile.experienceLevel}`)}
            />
            <DetailRow
              label={label("runningSinceYear")}
              value={profile.runningSinceYear ?? "—"}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("userCard.athlete.trainingTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-x-8 sm:grid-cols-2">
            <DetailRow
              label={label("weeklyMileageKm")}
              value={value(profile.weeklyMileageKm, t("userCard.units.km"))}
            />
            <DetailRow
              label={label("sessionsPerWeek")}
              value={profile.sessionsPerWeek}
            />
            <DetailRow
              label={label("availableTrainingDays")}
              value={days || "—"}
            />
            <DetailRow
              label={label("longRunDay")}
              value={
                profile.longRunDay
                  ? t(`userCard.weekdays.${profile.longRunDay}`)
                  : t("userCard.athlete.anyDay")
              }
            />
            <DetailRow
              label={label("preferredTimeOfDay")}
              value={t(
                `userCard.athlete.timesOfDay.${profile.preferredTimeOfDay}`,
              )}
            />
            <DetailRow
              label={label("preferredWorkoutDurationMinutes")}
              value={value(
                profile.preferredWorkoutDurationMinutes,
                t("userCard.units.min"),
              )}
            />
            <DetailRow
              label={label("longRunMaxDurationMinutes")}
              value={value(
                profile.longRunMaxDurationMinutes,
                t("userCard.units.min"),
              )}
            />
            <DetailRow
              label={label("limitations")}
              value={profile.limitations ?? "—"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("userCard.athlete.heartTitle")}</CardTitle>
            <CardDescription>
              {t(`userCard.athlete.zonesMethods.${profile.hrZonesMethod}`)}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-x-8 sm:grid-cols-3">
              <DetailRow
                label={label("restingHeartRate")}
                value={value(profile.restingHeartRate, t("userCard.units.bpm"))}
              />
              <DetailRow
                label={label("maxHeartRate")}
                value={
                  profile.maxHeartRate !== null
                    ? value(profile.maxHeartRate, t("userCard.units.bpm"))
                    : profile.maxHeartRateEstimate !== null
                      ? t("userCard.athlete.estimate", {
                          value: profile.maxHeartRateEstimate,
                        })
                      : "—"
                }
              />
              <DetailRow
                label={label("thresholdHeartRate")}
                value={value(
                  profile.thresholdHeartRate,
                  t("userCard.units.bpm"),
                )}
              />
            </div>
            {profile.hrZones ? (
              <ul className="flex flex-col divide-y text-sm">
                {profile.hrZones.map((zone) => (
                  <li key={zone.zone} className="flex justify-between py-1.5">
                    <span>
                      {t("userCard.athlete.zone", { zone: zone.zone })}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {zone.min ?? "—"}–{zone.max ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            ) : profile.hrZonesUnavailableReason ? (
              <p className="text-sm text-muted-foreground">
                {t(
                  `userCard.athlete.zonesUnavailable.${profile.hrZonesUnavailableReason}`,
                )}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <AthleteEditDialog
        profile={profile}
        open={editOpen}
        onOpenChange={setEditOpen}
        isPending={update.isPending}
        onSubmit={(input) =>
          update.mutate(input, { onSuccess: () => setEditOpen(false) })
        }
      />
    </div>
  );
}
