"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Switch } from "@workspace/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip";
import {
  CheckCircle2Icon,
  InfoIcon,
  PencilIcon,
  SendIcon,
  Trash2Icon,
  XCircleIcon,
} from "lucide-react";

import type {
  AdminUserDetail,
  AdminUserGroup,
  Permission,
} from "@workspace/api-client";

import { useAuth } from "@/components/auth-provider";
import { toInitials } from "@/entities/avatar/lib/initials";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { formatDate, useI18n } from "@/shared/i18n";
import { PermissionCatalogTable } from "@/features/permissions/components/permission-catalog-table";
import {
  useAssignGroupToUser,
  useAssignPermissionToUser,
  useDeleteUser,
  useInviteUser,
  useRevokeGroupFromUser,
  useRevokePermissionFromUser,
} from "@/features/users/hooks/use-users";
import {
  useGroups,
  usePermissionCatalog,
} from "@/features/permissions/hooks/use-permissions";
import { useUserPresence } from "@/features/users/hooks/use-user-presence";
import { AvatarPresenceDot } from "@/widgets/avatar-presence-dot";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { CopyButton } from "@/widgets/copy-button";
import { TableSkeleton } from "@/widgets/data-state";

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}): ReactElement {
  return (
    <div className="flex flex-col gap-1 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium break-words">{value}</span>
    </div>
  );
}

export function UserDetail({ user }: { user: AdminUserDetail }): ReactElement {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { hasPermission } = useAuth();

  const groupsQuery = useGroups(1, 100);
  const permissionsQuery = usePermissionCatalog();
  const assignGroup = useAssignGroupToUser();
  const revokeGroup = useRevokeGroupFromUser();
  const assignPermission = useAssignPermissionToUser();
  const revokePermission = useRevokePermissionFromUser();
  const inviteUser = useInviteUser();
  const deleteUser = useDeleteUser();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingGroupId, setPendingGroupId] = useState<string | null>(null);
  const [pendingPermissionId, setPendingPermissionId] = useState<string | null>(null);

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const fallbackInitials = toInitials(displayName);

  const { isOnline } = useUserPresence([user.id]);
  const online = isOnline(user.id);

  const userGroupIds = new Set(user.groups.map((group) => group.id));
  const allGroups = groupsQuery.data?.data ?? [];

  const userEffectivePermissionNames = new Set(user.effectivePermissions);

  const grantedPermissionIds = new Set(
    (permissionsQuery.data ?? [])
      .filter((permission) => userEffectivePermissionNames.has(permission.name))
      .map((permission) => permission.id),
  );

  const canUpdate = hasPermission("users.update");
  const canManage = hasPermission("users.manage");
  const canDelete = hasPermission("users.delete") && !user.isSystem;

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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="relative shrink-0">
            <Avatar className="size-14">
              <AvatarImage src={user.avatarUrl ?? undefined} alt={displayName} />
              <AvatarFallback>{fallbackInitials}</AvatarFallback>
            </Avatar>
            <AvatarPresenceDot
              online={online}
              className="size-3"
              label={t("presence.online")}
            />
          </span>
          <div className="space-y-1">
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {displayName}
              {online ? (
                <span className="text-sm font-normal text-muted-foreground">
                  {t("presence.online")}
                </span>
              ) : null}
            </h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canUpdate ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/users/${user.id}/edit`)}
            >
              <PencilIcon />
              {t("common.actions.edit")}
            </Button>
          ) : null}
          {canManage && !user.passwordChangedAt ? (
            <Button
              variant="outline"
              size="sm"
              disabled={inviteUser.isPending}
              onClick={() =>
                inviteUser.mutate(user.id, {
                  onSuccess: () => notifySuccess(t("users.toasts.invited")),
                  onError: (error) =>
                    notifyError(t("common.states.error"), getFriendlyApiMessage(error, t)),
                })
              }
            >
              <SendIcon />
              {t("users.actions.invite")}
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2Icon />
              {t("common.actions.delete")}
            </Button>
          ) : null}
        </div>
      </div>

      {user.isSystem ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <InfoIcon className="size-4" />
          {t("users.system")}
        </p>
      ) : null}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">{t("users.tabs.profile")}</TabsTrigger>
          <TabsTrigger value="access">{t("users.tabs.access")}</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
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
        </TabsContent>

        <TabsContent value="access" className="mt-4 flex flex-col gap-6">
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
                        <label htmlFor={switchId} className="flex flex-col gap-0.5 cursor-pointer">
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
                          onCheckedChange={(checked) =>
                            toggleGroup(group, checked)
                          }
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
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("users.confirmDelete.title")}
        description={t("users.confirmDelete.description", { name: displayName })}
        confirmLabel={t("common.actions.delete")}
        isPending={deleteUser.isPending}
        onConfirm={() =>
          deleteUser.mutate(user.id, {
            onSuccess: () => {
              setDeleteOpen(false);
              notifySuccess(t("users.toasts.deleted"));
              router.push("/users/list");
            },
            onError: (error) =>
              notifyError(t("common.states.error"), getFriendlyApiMessage(error, t)),
          })
        }
      />
    </div>
  );
}
