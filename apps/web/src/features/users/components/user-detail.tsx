"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";
import { Separator } from "@workspace/ui/components/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { InfoIcon, PencilIcon, SendIcon, Trash2Icon, XIcon } from "lucide-react";

import type {
  AdminUserDetail,
  AdminUserGroup,
  AdminUserPermission,
} from "@workspace/api-client";

import { useAuth } from "@/components/auth-provider";
import { toInitials } from "@/entities/avatar/lib/initials";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { formatDate, useI18n } from "@/shared/i18n";
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
import { usePermissionLabels } from "@/features/permissions/hooks/use-permission-labels";
import { useUserPresence } from "@/features/users/hooks/use-user-presence";
import { AvatarPresenceDot } from "@/widgets/avatar-presence-dot";
import { ConfirmDialog } from "@/widgets/confirm-dialog";

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
  const labels = usePermissionLabels();
  const assignGroup = useAssignGroupToUser();
  const revokeGroup = useRevokeGroupFromUser();
  const assignPermission = useAssignPermissionToUser();
  const revokePermission = useRevokePermissionFromUser();
  const inviteUser = useInviteUser();
  const deleteUser = useDeleteUser();

  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [selectedPermissionId, setSelectedPermissionId] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [groupToRevoke, setGroupToRevoke] = useState<AdminUserGroup | null>(null);
  const [permissionToRevoke, setPermissionToRevoke] =
    useState<AdminUserPermission | null>(null);

  const displayName =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const fallbackInitials = toInitials(displayName);

  const { isOnline } = useUserPresence([user.id]);
  const online = isOnline(user.id);

  const assignedGroupIds = new Set(user.groups.map((group) => group.id));
  const availableGroups =
    groupsQuery.data?.data.filter((group) => !assignedGroupIds.has(group.id)) ?? [];

  const individualPermissionNames = new Set(
    user.individualPermissions.map((permission) => permission.name),
  );
  const availablePermissions =
    permissionsQuery.data?.filter(
      (permission) => !individualPermissionNames.has(permission.name),
    ) ?? [];

  const canUpdate = hasPermission("users.update");
  const canManage = hasPermission("users.manage");
  const canDelete = hasPermission("users.delete") && !user.isSystem;

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
              {/* Only ever a positive signal: labelling someone "offline"
                  permanently is noise, and it would contradict the dot,
                  which deliberately disappears. */}
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
          <TabsTrigger value="groups">
            {t("users.tabs.groups")} ({user.groups.length})
          </TabsTrigger>
          <TabsTrigger value="permissions">
            {t("users.tabs.permissions")} ({user.individualPermissions.length})
          </TabsTrigger>
          <TabsTrigger value="effective">
            {t("users.tabs.effective")} ({user.effectivePermissions.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("users.tabs.profile")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 md:grid-cols-2">
              <DetailRow
                label={t("users.fields.avatar")}
                value={
                  user.avatarUrl ? (
                    <span className="break-all">{user.avatarUrl}</span>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow
                label={t("users.fields.referralCode")}
                value={user.referralCode ?? "—"}
              />
              <DetailRow
                label={t("users.fields.emailVerified")}
                value={
                  user.emailVerified ? t("common.yes") : t("common.no")
                }
              />
              <DetailRow
                label={t("users.fields.systemKey")}
                value={user.systemKey ?? "—"}
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

        <TabsContent value="groups" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("users.groups.assigned")}</CardTitle>
              {canManage && availableGroups.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedGroupId.length > 0 ? selectedGroupId : undefined}
                    onValueChange={(value) => setSelectedGroupId(value ?? "")}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue placeholder={t("users.groups.assignPlaceholder")} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableGroups.map((group) => (
                        <SelectItem key={group.id} value={group.id}>
                          {group.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={selectedGroupId.length === 0 || assignGroup.isPending}
                    onClick={() =>
                      assignGroup.mutate(
                        { userId: user.id, groupId: selectedGroupId },
                        {
                          onSuccess: () => {
                            setSelectedGroupId("");
                            notifySuccess(t("users.toasts.groupAssigned"));
                          },
                          onError: (error) =>
                            notifyError(
                              t("common.states.error"),
                              getFriendlyApiMessage(error, t),
                            ),
                        },
                      )
                    }
                  >
                    {t("users.groups.assignAction")}
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {user.groups.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("users.groups.empty")}
                </p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {user.groups.map((group) => (
                    <li
                      key={group.id}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <Link
                        href={`/users/groups/${group.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {group.name}
                      </Link>
                      <div className="flex items-center gap-2">
                        {group.isSystem ? (
                          <Badge variant="outline">{t("common.system")}</Badge>
                        ) : null}
                        {canManage ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("users.groups.revokeAction")}
                            onClick={() => setGroupToRevoke(group)}
                          >
                            <XIcon />
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("users.permissions.individual")}</CardTitle>
              {canManage && availablePermissions.length > 0 ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedPermissionId.length > 0 ? selectedPermissionId : undefined}
                    onValueChange={(value) => setSelectedPermissionId(value ?? "")}
                  >
                    <SelectTrigger className="w-56">
                      <SelectValue
                        placeholder={t("users.permissions.addPlaceholder")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePermissions.map((permission) => (
                        <SelectItem key={permission.id} value={permission.id}>
                          {labels.title(permission)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    disabled={selectedPermissionId.length === 0 || assignPermission.isPending}
                    onClick={() =>
                      assignPermission.mutate(
                        { userId: user.id, permissionId: selectedPermissionId },
                        {
                          onSuccess: () => {
                            setSelectedPermissionId("");
                            notifySuccess(t("users.toasts.permissionAssigned"));
                          },
                          onError: (error) =>
                            notifyError(
                              t("common.states.error"),
                              getFriendlyApiMessage(error, t),
                            ),
                        },
                      )
                    }
                  >
                    {t("users.permissions.addAction")}
                  </Button>
                </div>
              ) : null}
            </CardHeader>
            <CardContent>
              {user.individualPermissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("users.permissions.empty")}
                </p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {user.individualPermissions.map((permission) => (
                    <li
                      key={permission.name}
                      className="flex items-center justify-between gap-2 py-2"
                    >
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">
                          {labels.title(permission)}
                        </span>
                        {labels.description(permission) ? (
                          <span className="text-xs text-muted-foreground">
                            {labels.description(permission)}
                          </span>
                        ) : null}
                      </div>
                      {canManage ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("users.permissions.revokeAction")}
                          onClick={() => setPermissionToRevoke(permission)}
                        >
                          <XIcon />
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="effective" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("users.permissions.effective")}</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t("users.permissions.effectiveDescription")}
              </p>
            </CardHeader>
            <CardContent>
              {user.effectivePermissions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("users.permissions.effectiveEmpty")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {user.effectivePermissions.map((permission) => (
                    <Badge key={permission} variant="secondary">
                      {permission}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Separator className="opacity-0" />

      <ConfirmDialog
        open={groupToRevoke !== null}
        onOpenChange={(open) => {
          if (!open) {
            setGroupToRevoke(null);
          }
        }}
        title={t("users.confirmRevokeGroup.title")}
        description={t("users.confirmRevokeGroup.description", {
          name: groupToRevoke?.name ?? "",
        })}
        confirmLabel={t("users.groups.revokeAction")}
        isPending={revokeGroup.isPending}
        onConfirm={() => {
          if (!groupToRevoke) {
            return;
          }

          revokeGroup.mutate(
            { userId: user.id, groupId: groupToRevoke.id },
            {
              onSuccess: () => {
                setGroupToRevoke(null);
                notifySuccess(t("users.toasts.groupRevoked"));
              },
              onError: (error) =>
                notifyError(
                  t("common.states.error"),
                  getFriendlyApiMessage(error, t),
                ),
            },
          );
        }}
      />

      <ConfirmDialog
        open={permissionToRevoke !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPermissionToRevoke(null);
          }
        }}
        title={t("users.confirmRevokePermission.title")}
        description={t("users.confirmRevokePermission.description", {
          name: permissionToRevoke ? labels.title(permissionToRevoke) : "",
        })}
        confirmLabel={t("users.permissions.revokeAction")}
        isPending={revokePermission.isPending}
        onConfirm={() => {
          const permissionId = permissionsQuery.data?.find(
            (item) => item.name === permissionToRevoke?.name,
          )?.id;
          if (!permissionId) {
            setPermissionToRevoke(null);
            return;
          }

          revokePermission.mutate(
            { userId: user.id, permissionId },
            {
              onSuccess: () => {
                setPermissionToRevoke(null);
                notifySuccess(t("users.toasts.permissionRevoked"));
              },
              onError: (error) =>
                notifyError(
                  t("common.states.error"),
                  getFriendlyApiMessage(error, t),
                ),
            },
          );
        }}
      />

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
