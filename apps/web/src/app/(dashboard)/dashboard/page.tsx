"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  ArrowRightIcon,
  KeyRoundIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import {
  useGroups,
  usePermissionCatalog,
} from "@/features/permissions/hooks/use-permissions";
import { useUsers } from "@/features/users/hooks/use-users";
import { useI18n } from "@/shared/i18n";
import { PageHeader } from "@/widgets/page-header";

export default function DashboardPage(): ReactElement {
  const { t } = useI18n();
  const { hasPermission } = useAuth();

  const usersQuery = useUsers({ page: 1, limit: 1 });
  const groupsQuery = useGroups(1, 1);
  const permissionsQuery = usePermissionCatalog();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("dashboard.title")}
        description={t("dashboard.subtitle")}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>{t("dashboard.users")}</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <UsersIcon className="size-5 text-muted-foreground" />
              {usersQuery.data?.meta.total ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardAction>
            {hasPermission("users.read") ? (
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/users/list" />}
              >
                <ArrowRightIcon />
                {t("dashboard.goToUsers")}
              </Button>
            ) : null}
          </CardAction>
          <CardContent className="sr-only">
            {t("dashboard.goToUsers")}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t("dashboard.groups")}</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <ShieldCheckIcon className="size-5 text-muted-foreground" />
              {groupsQuery.data?.meta.total ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardAction>
            {hasPermission("permissions.read") ? (
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/users/groups" />}
              >
                <ArrowRightIcon />
                {t("dashboard.groups")}
              </Button>
            ) : null}
          </CardAction>
          <CardContent className="sr-only">{t("dashboard.groups")}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>{t("dashboard.permissions")}</CardDescription>
            <CardTitle className="flex items-center gap-2 text-3xl">
              <KeyRoundIcon className="size-5 text-muted-foreground" />
              {permissionsQuery.data?.length ?? "—"}
            </CardTitle>
          </CardHeader>
          <CardAction>
            {hasPermission("permissions.read") ? (
              <Button
                variant="ghost"
                size="sm"
                render={<Link href="/users/groups" />}
              >
                <ArrowRightIcon />
                {t("permissions.manageHint")}
              </Button>
            ) : null}
          </CardAction>
          <CardContent className="sr-only">
            {t("permissions.manageHint")}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
