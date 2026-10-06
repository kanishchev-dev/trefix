"use client";

import { useState, type ReactElement } from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Switch } from "@workspace/ui/components/switch";
import { InfoIcon } from "lucide-react";

import type { AppSettings, Permission } from "@workspace/api-client";

import { useAuth } from "@/components/auth-provider";
import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useI18n } from "@/shared/i18n";
import { PermissionCatalogTable } from "@/features/permissions/components/permission-catalog-table";
import {
  useGroups,
  usePermissionCatalog,
} from "@/features/permissions/hooks/use-permissions";
import {
  useSettings,
  useUpdateSettings,
} from "@/features/settings/hooks/use-settings";
import { TableSkeleton } from "@/widgets/data-state";

export function AuthenticationSettings(): ReactElement {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const settingsQuery = useSettings();
  const groupsQuery = useGroups(1, 100);
  const permissionsQuery = usePermissionCatalog();
  const updateSettings = useUpdateSettings();

  const editorKey = settingsQuery.data
    ? `settings-${settingsQuery.dataUpdatedAt}`
    : "settings-loading";

  const isLoading =
    settingsQuery.isLoading || groupsQuery.isLoading || permissionsQuery.isLoading;
  const settings = settingsQuery.data;

  return (
    <div className="flex flex-col gap-4" key={editorKey}>
      <EditorFields
        settings={settings}
        isLoading={isLoading}
        canManage={hasPermission("permissions.manage")}
        groupsQuery={groupsQuery}
        updateSettings={updateSettings}
        t={t}
      />
    </div>
  );
}

function EditorFields({
  settings,
  isLoading,
  canManage,
  groupsQuery,
  updateSettings,
  t,
}: {
  settings?: AppSettings;
  isLoading: boolean;
  canManage: boolean;
  groupsQuery: ReturnType<typeof useGroups>;
  updateSettings: ReturnType<typeof useUpdateSettings>;
  t: (key: string, params?: Record<string, string | number>) => string;
}): ReactElement {
  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    settings?.defaultGroups ?? [],
  );
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    settings?.defaultPermissions ?? [],
  );

  const selectedGroupSet = new Set(selectedGroups);
  const selectedPermissionSet = new Set(selectedPermissions);

  function toggleGroup(groupId: string, active: boolean): void {
    setSelectedGroups((prev) =>
      active ? [...prev, groupId] : prev.filter((id) => id !== groupId),
    );
  }

  function togglePermission(permission: Permission, active: boolean): void {
    setSelectedPermissions((prev) =>
      active
        ? [...prev, permission.id]
        : prev.filter((id) => id !== permission.id),
    );
  }

  function handleSave(): void {
    updateSettings.mutate(
      { defaultGroups: selectedGroups, defaultPermissions: selectedPermissions },
      {
        onSuccess: () => notifySuccess(t("settings.toasts.saved")),
        onError: (error) =>
          notifyError(t("common.states.error"), getFriendlyApiMessage(error, t)),
      },
    );
  }

  const allGroups = groupsQuery.data?.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.authentication.defaultGroups")}</CardTitle>
          <CardDescription>
            {t("settings.authentication.defaultGroupsHint")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <TableSkeleton rows={3} columns={2} />
          ) : allGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("groups.empty")}</p>
          ) : (
            <ul className="flex flex-col divide-y">
              {allGroups.map((group) => {
                const assigned = selectedGroupSet.has(group.id);
                const switchId = `default-group-${group.id}`;

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
                      disabled={!canManage}
                      onCheckedChange={(checked) =>
                        toggleGroup(group.id, checked)
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
          <CardTitle>{t("settings.authentication.defaultPermissions")}</CardTitle>
          <CardDescription>
            {t("settings.authentication.defaultPermissionsHint")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PermissionCatalogTable
            grantedPermissionIds={selectedPermissionSet}
            onTogglePermission={togglePermission}
            disabled={!canManage}
            idPrefix="default-permission"
          />
        </CardContent>
      </Card>

      <div className="flex items-center gap-4">
        {canManage ? (
          <Button onClick={handleSave} disabled={updateSettings.isPending || isLoading}>
            {updateSettings.isPending
              ? t("common.actions.loading")
              : t("common.actions.save")}
          </Button>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <InfoIcon className="size-4" />
            {t("accessDenied.description")}
          </p>
        )}
        {settings ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <InfoIcon className="size-3" />
            {t("settings.authentication.inviteFlowHint")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
