"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import { Button } from "@trefix/ui/components/button";
import { ButtonGroup } from "@trefix/ui/components/button-group";
import {
  Card,
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
import { CheckIcon, GitPullRequestArrowIcon, XIcon } from "lucide-react";

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
        <ItemGroup className="gap-2">
          {items.map((adaptation) => (
            <Item key={adaptation.id} variant="outline" size="sm">
              <ItemMedia variant="icon">
                <GitPullRequestArrowIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  {adaptation.reason}
                  <Badge variant="outline">
                    {t("userCard.adaptations.confidence", {
                      value: Math.round(adaptation.confidence * 100),
                    })}
                  </Badge>
                </ItemTitle>
                <ItemDescription>
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
                </ItemDescription>
              </ItemContent>
              {canManage ? (
                <ItemActions>
                  <ButtonGroup>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={decide.isPending}
                      onClick={() =>
                        decide.mutate({
                          adaptationId: adaptation.id,
                          decision: "apply",
                        })
                      }
                    >
                      <CheckIcon />
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
                      <XIcon />
                      {t("userCard.adaptations.dismiss")}
                    </Button>
                  </ButtonGroup>
                </ItemActions>
              ) : null}
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
