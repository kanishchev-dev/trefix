"use client";

import type { ReactElement } from "react";

import { Switch } from "@workspace/ui/components/switch";

import type { Permission } from "@workspace/api-client";

import { useI18n } from "@/shared/i18n";
import {
  UNGROUPED_RESOURCE,
  groupPermissionsByModule,
  splitPermissionName,
} from "@/features/permissions/lib/permission-domains";
import { usePermissionLabels } from "@/features/permissions/hooks/use-permission-labels";
import { usePermissionCatalog } from "@/features/permissions/hooks/use-permissions";
import { TableSkeleton } from "@/widgets/data-state";

export interface PermissionCatalogTableProps {
  grantedPermissionIds: Set<string>;
  onTogglePermission: (permission: Permission, granted: boolean) => void;
  pendingPermissionId?: string | null;
  disabled?: boolean;
  idPrefix?: string;
}

export function PermissionCatalogTable({
  grantedPermissionIds,
  onTogglePermission,
  pendingPermissionId,
  disabled = false,
  idPrefix = "permission",
}: PermissionCatalogTableProps): ReactElement {
  const { t } = useI18n();
  const permissionsQuery = usePermissionCatalog();
  const labels = usePermissionLabels();

  const catalog = permissionsQuery.data ?? [];
  const modules = groupPermissionsByModule(catalog);

  if (permissionsQuery.isLoading) {
    return <TableSkeleton rows={6} columns={2} />;
  }

  if (catalog.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("permissions.sectionEmpty")}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {modules.map(({ module, resources }) => (
        <section key={module || "ungrouped"} className="flex flex-col gap-1">
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
                  <h4 className="pt-2 text-xs font-medium text-muted-foreground/80">
                    {resourceName}
                  </h4>
                ) : null}
                <ul className="flex flex-col divide-y">
                  {permissions.map((permission) => {
                    const { action } = splitPermissionName(permission.name);
                    const checked = grantedPermissionIds.has(permission.id);
                    const isPending = pendingPermissionId === permission.id;
                    const description = labels.description(permission);
                    const elementId = `${idPrefix}-${permission.id}`;

                    return (
                      <li
                        key={permission.id}
                        className="flex items-center justify-between gap-4 py-2.5"
                      >
                        <label
                          htmlFor={elementId}
                          className="flex flex-col cursor-pointer"
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
                          id={elementId}
                          checked={checked}
                          disabled={disabled || isPending}
                          onCheckedChange={(newChecked) =>
                            onTogglePermission(permission, newChecked)
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
  );
}
