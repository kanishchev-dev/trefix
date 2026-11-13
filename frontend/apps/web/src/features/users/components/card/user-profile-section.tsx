"use client";

import type { ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@trefix/ui/components/tooltip";
import { CheckCircle2Icon, XCircleIcon } from "lucide-react";

import { useUserCard } from "@/features/users/context/user-card-context";
import { formatDate, useI18n } from "@/shared/i18n";
import { CopyButton } from "@/widgets/copy-button";

import { DetailRow } from "./detail-row";

export function UserProfileSection(): ReactElement {
  const { t, locale } = useI18n();
  const user = useUserCard();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("users.tabs.profile")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-x-8 md:grid-cols-2">
        <DetailRow
          label={t("users.fields.firstName")}
          value={user.firstName || "—"}
        />
        <DetailRow
          label={t("users.fields.lastName")}
          value={user.lastName || "—"}
        />
        <DetailRow
          label={t("users.fields.email")}
          value={
            <span className="flex flex-wrap items-center gap-2">
              <span className="break-all">{user.email}</span>
              <Tooltip>
                <TooltipTrigger
                  render={
                    user.emailVerified ? (
                      <Badge variant="outline" />
                    ) : (
                      <Badge variant="secondary" />
                    )
                  }
                >
                  {user.emailVerified ? (
                    <CheckCircle2Icon data-icon="inline-start" />
                  ) : (
                    <XCircleIcon data-icon="inline-start" />
                  )}
                  {user.emailVerified
                    ? t("users.email.verified")
                    : t("users.email.notVerified")}
                </TooltipTrigger>
                <TooltipContent>
                  {user.emailVerified
                    ? t("users.email.verifiedHint")
                    : t("users.email.notVerifiedHint")}
                </TooltipContent>
              </Tooltip>
            </span>
          }
        />
        <DetailRow
          label={t("users.fields.emailVerifiedAt")}
          value={formatDate(user.emailVerifiedAt, locale)}
        />
        <DetailRow
          label={t("users.fields.id")}
          value={
            <span className="flex items-center gap-1">
              <span className="font-mono text-xs break-all">{user.id}</span>
              <CopyButton value={user.id} label={t("users.actions.copyId")} />
            </span>
          }
        />
        <DetailRow
          label={t("users.fields.referralCode")}
          value={user.referralCode ?? "—"}
        />
        <DetailRow
          label={t("users.fields.createdAt")}
          value={formatDate(user.createdAt, locale)}
        />
        <DetailRow
          label={t("users.fields.updatedAt")}
          value={formatDate(user.updatedAt, locale)}
        />
        <DetailRow
          label={t("users.fields.passwordChangedAt")}
          value={formatDate(user.passwordChangedAt, locale)}
        />
      </CardContent>
    </Card>
  );
}
