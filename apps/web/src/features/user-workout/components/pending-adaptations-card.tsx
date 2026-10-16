"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";

import { useAuth } from "@/components/auth-provider";
import { formatDate, useI18n } from "@/shared/i18n";

import {
  useAdminAdaptations,
  useDecideAdaptation,
} from "../hooks/use-admin-workout";

/** Plan changes the engine proposed and the athlete has not decided on yet. */
export function PendingAdaptationsCard({
  userId,
}: {
  userId: string;
}): ReactElement | null {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const query = useAdminAdaptations(userId);
  const decide = useDecideAdaptation(userId);
  const canManage = hasPermission("training.userplans.manage");
  const items = query.data ?? [];

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.adaptations.title")}</CardTitle>
        <CardDescription>
          {t("userCard.adaptations.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col divide-y">
          {items.map((adaptation) => (
            <li
              key={adaptation.id}
              className="flex flex-wrap items-start justify-between gap-4 py-3"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {adaptation.reason}
                  <Badge variant="outline">
                    {t("userCard.adaptations.confidence", {
                      value: Math.round(adaptation.confidence * 100),
                    })}
                  </Badge>
                </span>
                <span className="text-xs text-muted-foreground">
                  {adaptation.type} · {formatDate(adaptation.createdAt, locale)}
                  {adaptation.workoutId ? (
                    <>
                      {" · "}
                      <Link
                        href={`/users/${userId}/workouts/${adaptation.workoutId}`}
                        className="underline underline-offset-4"
                      >
                        {t("userCard.adaptations.workout")}
                      </Link>
                    </>
                  ) : null}
                </span>
              </div>
              {canManage ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        adaptationId: adaptation.id,
                        decision: "apply",
                      })
                    }
                  >
                    {t("userCard.adaptations.apply")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={decide.isPending}
                    onClick={() =>
                      decide.mutate({
                        adaptationId: adaptation.id,
                        decision: "dismiss",
                      })
                    }
                  >
                    {t("userCard.adaptations.dismiss")}
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
