/**
 * Permission names follow a `<module>.<resource>.<action>` convention (see
 * `SYSTEM_PERMISSION_CATALOG` on the backend). Some modules have a single
 * resource and omit it: `settings.read`.
 *
 * The admin UI presents the whole catalog as modules, so a group reads as a
 * list of modules, each with the resources it exposes, each with the rights
 * that can be toggled.
 *
 * These helpers are pure so the grouping logic can be unit tested without a
 * React tree.
 */

/** Names used for parts a permission does not declare. */
export const UNGROUPED_MODULE = "";
export const UNGROUPED_RESOURCE = "";

export type PermissionNameParts = {
  module: string;
  resource: string;
  action: string;
};

export type PermissionResource<T> = {
  resource: string;
  permissions: T[];
};

export type PermissionModule<T> = {
  module: string;
  resources: PermissionResource<T>[];
};

/**
 * Splits `training.plans.update` into
 * `{ module: 'training', resource: 'plans', action: 'update' }`.
 *
 * Only the last segment is the action, so a name with two or three segments
 * always keeps its meaning. Names with one segment, or a leading dot, have no
 * module/resource and are collected under {@link UNGROUPED_MODULE} so they still
 * render instead of disappearing from the settings screen.
 */
export function splitPermissionName(name: string): PermissionNameParts {
  const segments = name.split(".").filter((segment) => segment.length > 0);

  if (segments.length <= 1) {
    return {
      module: UNGROUPED_MODULE,
      resource: UNGROUPED_RESOURCE,
      action: segments[0] ?? name,
    };
  }

  return {
    module: segments[0],
    resource: segments.length > 2 ? segments.slice(1, -1).join(".") : UNGROUPED_RESOURCE,
    action: segments[segments.length - 1],
  };
}

/**
 * Groups permissions by module and then by resource, preserving the incoming
 * order so the backend ordering stays authoritative.
 */
export function groupPermissionsByModule<T extends { name: string }>(
  permissions: readonly T[],
): PermissionModule<T>[] {
  const modules = new Map<string, Map<string, T[]>>();

  for (const permission of permissions) {
    const { module, resource } = splitPermissionName(permission.name);

    const resources = modules.get(module) ?? new Map<string, T[]>();
    const bucket = resources.get(resource);

    if (bucket) {
      bucket.push(permission);
    } else {
      resources.set(resource, [permission]);
    }

    modules.set(module, resources);
  }

  return Array.from(modules, ([module, resources]) => ({
    module,
    resources: Array.from(resources, ([resource, items]) => ({
      resource,
      permissions: items,
    })),
  }));
}
