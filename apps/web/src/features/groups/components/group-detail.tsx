"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactElement } from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Switch } from "@workspace/ui/components/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import { InfoIcon, PencilIcon, Trash2Icon } from "lucide-react";

import type { Permission, PermissionGroup } from "@workspace/api-client";

import { useAuth } from "@/components/auth-provider";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { formatDate, useI18n } from "@/shared/i18n";
import {
  UNGROUPED_RESOURCE,
  groupPermissionsByModule,
  splitPermissionName,
} from "@/features/permissions/lib/permission-domains";
import { usePermissionLabels } from "@/features/permissions/hooks/use-permission-labels";
import {
  useAssignPermissionToGroup,
  useDeleteGroup,
  usePermissionCatalog,
  useRevokePermissionFromGroup,
} from "@/features/permissions/hooks/use-permissions";
import { ConfirmDialog } from "@/widgets/confirm-dialog";
import { TableSkeleton } from "@/widgets/data-state";

export function GroupDetail({ group }: { group: PermissionGroup }): ReactElement {
  const { t, locale } = useI18n();
  const router = useRouter();
  const { hasPermission } = useAuth();

  const permissionsQuery = usePermissionCatalog();
  const assignPermission = useAssignPermissionToGroup();
  const revokePermission = useRevokePermissionFromGroup();
  const deleteGroup = useDeleteGroup();

  const [deleteOpen, setDeleteOpen] = useState(false);
  // Only the switch that is being saved is disabled, so the rest of the
  // catalog stays interactive while a mutation is in flight.
  const [pendingPermissionId, setPendingPermissionId] = useState<string | null>(null);

  const groupPermissionIds = new Set(
    (group.permissions ?? []).map((permission) => permission.id),
  );
  const catalog = permissionsQuery.data ?? [];
  const modules = groupPermissionsByModule(catalog);
  const labels = usePermissionLabels();

  const canManage = hasPermission("permissions.manage");

  const togglePermission = (permission: Permission, granted: boolean) => {
    setPendingPermissionId(permission.id);

    const onSettled = () => setPendingPermissionId(null);
    const onError = (error: unknown) =>
      notifyError(t("common.states.error"), getFriendlyApiMessage(error, t));

    const mutation = granted
      ? assignPermission.mutate(
          { groupId: group.id, permissionId: permission.id },
          {
            onSuccess: () => notifySuccess(t("groups.toasts.permissionAdded")),
            onError,
            onSettled,
          },
        )
      : revokePermission.mutate(
          { groupId: group.id, permissionId: permission.id },
          {
            onSuccess: () => notifySuccess(t("groups.toasts.permissionRemoved")),
            onError,
            onSettled,
          },
        );

    return mutation;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{group.name}</h1>
            {group.isSystem ? (
              <Badge variant="outline">{t("common.system")}</Badge>
            ) : null}
          </div>
          {group.description ? (
            <p className="text-sm text-muted-foreground">{group.description}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          {canManage && !group.isSystem ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/users/groups/${group.id}/edit`)}
            >
              <PencilIcon />
              {t("common.actions.edit")}
            </Button>
          ) : null}
          {canManage && !group.isSystem ? (
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

      {group.isSystem ? (
        <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          <InfoIcon className="size-4" />
          {t("groups.system")}
        </p>
      ) : null}

      <Tabs defaultValue="permissions">
        <TabsList>
          <TabsTrigger value="permissions">
            {t("groups.tabs.permissions")} ({group.permissions?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="members">
            {t("groups.tabs.members")} ({group.users?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="info">{t("groups.tabs.info")}</TabsTrigger>
        </TabsList>

        <TabsContent value="permissions" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("groups.tabs.permissions")}</CardTitle>
              <CardDescription>{t("groups.permissions.hint")}</CardDescription>
            </CardHeader>
            <CardContent>
              {permissionsQuery.isLoading ? (
                <TableSkeleton rows={6} columns={2} />
              ) : catalog.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("permissions.sectionEmpty")}
                </p>
              ) : (
                <div className="flex flex-col gap-6">
                  {modules.map(({ module, resources }) => (
                    <section
                      key={module || "ungrouped"}
                      className="flex flex-col gap-1"
                    >
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {labels.moduleLabel(module)}
                      </h3>
                      {resources.map(({ resource, permissions }) => {
                        const resourceName =
                          resource === UNGROUPED_RESOURCE
                            ? ""
                            : labels.resourceLabel(module, resource);

                        return (
                          <div key={resource || "root"} className="flex flex-col gap-1">
                            {resourceName ? (
                              <h4 className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                                {resourceName}
                              </h4>
                            ) : null}
                            <ul className="flex flex-col divide-y">
                              {permissions.map((permission) => {
                                const { action } = splitPermissionName(permission.name);
                                const granted = groupPermissionIds.has(permission.id);
                                const isPending = pendingPermissionId === permission.id;
                                const description = labels.description(permission);

                                return (
                                  <li
                                    key={permission.id}
                                    className="flex items-center justify-between gap-4 py-2.5"
                                  >
                                    <label
                                      htmlFor={`group-permission-${permission.id}`}
                                      className="flex flex-col"
                                    >
                                      <span className="text-sm font-medium">
                                        {labels.actionLabel(action)}
                                      </span>
                                      {description ? (
                                        <span className="text-xs text-muted-foreground">
                                          {description}
                                        </span>
                                      ) : null}
                                    </label>
                                    <Switch
                                      id={`group-permission-${permission.id}`}
                                      checked={granted}
                                      disabled={!canManage || isPending}
                                      onCheckedChange={(checked) =>
                                        togglePermission(permission, checked)
                                      }
                                    />
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </section>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("groups.tabs.members")}</CardTitle>
            </CardHeader>
            <CardContent>
              {!group.users || group.users.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("groups.members.empty")}
                </p>
              ) : (
                <ul className="flex flex-col divide-y">
                  {group.users.map((member) => (
                    <li key={member.id} className="flex items-center justify-between py-2">
                      <Link
                        href={`/users/${member.id}`}
                        className="text-sm font-medium hover:underline"
                      >
                        {[member.firstName, member.lastName]
                          .filter(Boolean)
                          .join(" ") || member.email}
                      </Link>
                      <span className="text-sm text-muted-foreground">
                        {member.email}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("groups.tabs.info")}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-x-8 md:grid-cols-2">
              <div className="flex flex-col gap-1 py-2">
                <span className="text-sm text-muted-foreground">
                  {t("groups.fields.systemKey")}
                </span>
                <span className="text-sm font-medium">{group.systemKey ?? "—"}</span>
              </div>
              <div className="flex flex-col gap-1 py-2">
                <span className="text-sm text-muted-foreground">
                  {t("groups.fields.createdAt")}
                </span>
                <span className="text-sm font-medium">
                  {formatDate(group.createdAt, locale)}
                </span>
              </div>
              <div className="flex flex-col gap-1 py-2">
                <span className="text-sm text-muted-foreground">
                  {t("groups.fields.updatedAt")}
                </span>
                <span className="text-sm font-medium">
                  {formatDate(group.updatedAt, locale)}
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("groups.confirmDelete.title")}
        description={t("groups.confirmDelete.description", { name: group.name })}
        confirmLabel={t("common.actions.delete")}
        isPending={deleteGroup.isPending}
        onConfirm={() =>
          deleteGroup.mutate(group.id, {
            onSuccess: () => {
              setDeleteOpen(false);
              notifySuccess(t("groups.toasts.deleted"));
              router.push("/users/groups");
            },
            onError: (error) =>
              notifyError(t("common.states.error"), getFriendlyApiMessage(error, t)),
          })
        }
      />
    </div>
  );
}
