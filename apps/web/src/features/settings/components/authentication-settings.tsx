"use client";

import { useState, type ReactElement } from "react";

import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card";
import { Checkbox } from "@workspace/ui/components/checkbox";
import { Label } from "@workspace/ui/components/label";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { InfoIcon } from "lucide-react";

import type { AppSettings } from "@workspace/api-client";

import { getFriendlyApiMessage } from "@/lib/errors";
import { notifyError, notifySuccess } from "@/lib/notifications";
import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/shared/i18n";
import {
  useGroups,
  usePermissionCatalog,
} from "@/features/permissions/hooks/use-permissions";
import { usePermissionLabels } from "@/features/permissions/hooks/use-permission-labels";
import {
  useSettings,
  useUpdateSettings,
} from "@/features/settings/hooks/use-settings";

export function AuthenticationSettings(): ReactElement {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const settingsQuery = useSettings();
  const groupsQuery = useGroups(1, 100);
  const permissionsQuery = usePermissionCatalog();
  const updateSettings = useUpdateSettings();

  // Remount the editor whenever server data changes so the local checkbox
  // state always starts from the persisted settings (no sync effect needed).
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
        permissionsQuery={permissionsQuery}
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
  permissionsQuery,
  updateSettings,
  t,
}: {
  settings?: AppSettings;
  isLoading: boolean;
  canManage: boolean;
  groupsQuery: ReturnType<typeof useGroups>;
  permissionsQuery: ReturnType<typeof usePermissionCatalog>;
  updateSettings: ReturnType<typeof useUpdateSettings>;
  t: (key: string, params?: Record<string, string | number>) => string;
}): ReactElement {
  const [selectedGroups, setSelectedGroups] = useState<string[]>(
    settings?.defaultGroups ?? [],
  );
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    settings?.defaultPermissions ?? [],
  );
  const labels = usePermissionLabels();

  function toggle(
    list: string[],
    setList: (value: string[]) => void,
    id: string,
  ): void {
    setList(
      list.includes(id) ? list.filter((item) => item !== id) : [...list, id],
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

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.authentication.defaultGroups")}</CardTitle>
          <CardDescription>
            {t("settings.authentication.defaultGroupsHint")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-full max-w-sm" />
              <Skeleton className="h-6 w-full max-w-xs" />
            </div>
          ) : groupsQuery.data && groupsQuery.data.data.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {groupsQuery.data.data.map((group) => (
                <Label
                  key={group.id}
                  className="flex items-center gap-2 rounded-xl border p-3 text-sm font-normal"
                >
                  <Checkbox
                    checked={selectedGroups.includes(group.id)}
                    disabled={!canManage}
                    onCheckedChange={() =>
                      toggle(selectedGroups, setSelectedGroups, group.id)
                    }
                  />
                  <span className="flex-1">{group.name}</span>
                  {group.isSystem ? (
                    <Badge variant="outline">{t("common.system")}</Badge>
                  ) : null}
                </Label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("groups.empty")}</p>
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
          {isLoading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-6 w-full max-w-sm" />
              <Skeleton className="h-6 w-full max-w-xs" />
            </div>
          ) : permissionsQuery.data && permissionsQuery.data.length > 0 ? (
            <div className="grid gap-2 md:grid-cols-2">
              {permissionsQuery.data.map((permission) => (
                <Label
                  key={permission.id}
                  className="flex items-center gap-2 rounded-xl border p-3 text-sm font-normal"
                >
                  <Checkbox
                    checked={selectedPermissions.includes(permission.id)}
                    disabled={!canManage}
                    onCheckedChange={() =>
                      toggle(
                        selectedPermissions,
                        setSelectedPermissions,
                        permission.id,
                      )
                    }
                  />
                  <span className="flex-1">
                    <span>{labels.title(permission)}</span>
                    {labels.description(permission) ? (
                      <span className="block text-xs text-muted-foreground">
                        {labels.description(permission)}
                      </span>
                    ) : null}
                  </span>
                </Label>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("permissions.empty")}</p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        {canManage ? (
          <Button onClick={handleSave} disabled={updateSettings.isPending || isLoading}>
            {updateSettings.isPending
              ? t("common.actions.loading")
              : t("common.actions.save")}
          </Button>
        ) : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <InfoIcon className="size-3" />
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
