"use client";

import { useCallback } from "react";

import { useI18n } from "@/shared/i18n";

import {
  UNGROUPED_MODULE,
  UNGROUPED_RESOURCE,
  splitPermissionName,
} from "../lib/permission-domains";

type TranslatablePermission = {
  name: string;
  description?: string | null;
};

export type PermissionLabels = {
  /** Human name of a module, e.g. `training` -> "Training". */
  moduleLabel: (module: string) => string;
  /** Human name of a resource, e.g. `plans` in `training.plans.read`. */
  resourceLabel: (module: string, resource: string) => string;
  /** Human name of an action, e.g. `update` -> "Edit". */
  actionLabel: (action: string) => string;
  /** Short title for a permission without module context, e.g. "Training / Plans / Edit". */
  title: (permission: TranslatablePermission) => string;
  /** Description shown under the title; undefined when there is nothing to show. */
  description: (permission: TranslatablePermission) => string | undefined;
};

/**
 * Resolves permission names into readable text.
 *
 * Every label has a deliberate fallback chain, because permissions are added
 * by developers through the backend seed: a new `billing.export` permission has
 * to render as something understandable even before anyone adds translations
 * for it. Titles fall back to the raw segments, descriptions fall back to the
 * description stored with the permission in the database.
 */
export function usePermissionLabels(): PermissionLabels {
  const { t } = useI18n();

  const translate = useCallback(
    (key: string, fallback: string): string => {
      const label = t(key);
      return label === key ? fallback : label;
    },
    [t],
  );

  const moduleLabel = useCallback(
    (module: string): string =>
      module === UNGROUPED_MODULE
        ? translate("permissions.domains.other", "Other")
        : translate(`permissions.domains.${module}`, module),
    [translate],
  );

  const resourceLabel = useCallback(
    (module: string, resource: string): string => {
      if (resource === UNGROUPED_RESOURCE) {
        return "";
      }
      return translate(`permissions.resources.${module}.${resource}`, resource);
    },
    [translate],
  );

  const actionLabel = useCallback(
    (action: string): string =>
      translate(`permissions.actions.${action}`, action),
    [translate],
  );

  const title = useCallback(
    (permission: TranslatablePermission): string => {
      const { module, resource, action } = splitPermissionName(permission.name);
      const parts = [
        moduleLabel(module),
        resourceLabel(module, resource),
        actionLabel(action),
      ];

      return parts.filter(Boolean).join(" / ");
    },
    [actionLabel, moduleLabel, resourceLabel],
  );

  const description = useCallback(
    (permission: TranslatablePermission): string | undefined => {
      const translated = translate(
        `permissions.descriptions.${permission.name}`,
        "",
      );
      const fallback = permission.description?.trim();

      return translated || fallback || undefined;
    },
    [translate],
  );

  return { moduleLabel, resourceLabel, actionLabel, title, description };
}
