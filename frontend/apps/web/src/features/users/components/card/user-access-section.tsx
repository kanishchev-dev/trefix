"use client";

import { useState, type ReactElement } from "react";

import { Badge } from "@trefix/ui/components/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import { Switch } from "@trefix/ui/components/switch";

import type { AdminUserGroup, Permission } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { PermissionCatalogTable } from "@/features/permissions/components/permission-catalog-table";
import {
  useGroups,
  usePermissionCatalog,
} from "@/features/permissions/hooks/use-permissions";
import { useUserCard } from "@/features/users/context/user-card-context";
import {
  useAssignGroupToUser,
  useAssignPermissionToUser,
  useRevokeGroupFromUser,
  useRevokePermissionFromUser,
} from "@/features/users/hooks/use-users";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import { TableSkeleton } from "@/widgets/data-state";

export function UserAccessSection(): ReactElement {
  const { t } = useI18n();
  const user = useUserCard();
  const { hasPermission } = useAuth();

  const groupsQuery = useGroups(1, 100);
  const permissionsQuery = usePermissionCatalog();
  const assignGroup = useAssignGroupToUser();
  const revokeGroup = useRevokeGroupFromUser();
  const assignPermission = useAssignPermissionToUser();
  const revokePermission = useRevokePermissionFromUser();

  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [pendingPermissionId, setPendingPermissionId] = useState<string | null>(
    null,
  );

  const userGroupIds = new Set(user.groups.map((group) => group.id));
  const allGroups = groupsQuery.data?.data ?? [];
  const userEffectivePermissionNames = new Set(user.effectivePermissions);
  const grantedPermissionIds = new Set(
    (permissionsQuery.data ?? [])
      .filter((permission) => userEffectivePermissionNames.has(permission.name))
      .map((permission) => permission.id),
  );
  const canManage = hasPermission("users.manage");

  const toggleGroup = (group: AdminUserGroup, assigned: boolean) => {
    setPendingGroupId(group.id);

    const onSettled = () => setPendingGroupId(null);
    const onError = (error: unknown) =>
      notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));

    if (assigned) {
      assignGroup.mutate(
        { userId: user.id, groupId: group.id },
        {
          onSuccess: () => notifySuccess(t("users.toasts.groupAssigned")),
          onError,
          onSettled,
        },
      );
    } else {
      revokeGroup.mutate(
        { userId: user.id, groupId: group.id },
        {
          onSuccess: () => notifySuccess(t("users.toasts.groupRevoked")),
          onError,
          onSettled,
        },
      );
    }
  };

  const togglePermission = (permission: Permission, granted: boolean) => {
    setPendingPermissionId(permission.id);

    const onSettled = () => setPendingPermissionId(null);
    const onError = (error: unknown) =>
      notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));

    if (granted) {
      assignPermission.mutate(
        { userId: user.id, permissionId: permission.id },
        {
          onSuccess: () => notifySuccess(t("users.toasts.permissionAssigned")),
          onError,
          onSettled,
        },
      );
    } else {
      revokePermission.mutate(
        { userId: user.id, permissionId: permission.id },
        {
          onSuccess: () => notifySuccess(t("users.toasts.permissionRevoked")),
          onError,
          onSettled,
        },
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("users.access.groupsTitle")}</CardTitle>
          <CardDescription>{t("users.access.groupsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {groupsQuery.isLoading ? (
            <TableSkeleton rows={3} columns={2} />
          ) : allGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("users.access.groupsEmpty")}
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {allGroups.map((group) => {
                const assigned = userGroupIds.has(group.id);
                const isPending = pendingGroupId === group.id;
                const switchId = `user-group-${group.id}`;

                return (
                  <li
                    key={group.id}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <label
                      htmlFor={switchId}
                      className="flex flex-col gap-0.5 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium hover:underline">
                          {group.name}
                        </span>
                        {group.isSystem ? (
                          <Badge variant="outline">{t("common.system")}</Badge>
                        ) : null}
                      </div>
                      {group.description ? (
                        <p className="text-xs text-muted-foreground">
                          {group.description}
                        </p>
                      ) : null}
                    </label>
                    <Switch
                      id={switchId}
                      checked={assigned}
                      disabled={!canManage || isPending}
                      onCheckedChange={(checked) => toggleGroup(group, checked)}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("users.access.permissionsTitle")}</CardTitle>
          <CardDescription>{t("users.access.permissionsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <PermissionCatalogTable
            grantedPermissionIds={grantedPermissionIds}
            onTogglePermission={togglePermission}
            pendingPermissionId={pendingPermissionId}
            disabled={!canManage}
            idPrefix={`user-${user.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
