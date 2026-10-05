import { getSystemPermissionKeys } from '@/modules/permissions/constants/system-access.constants';

export const REALTIME_ROOM_PERMISSION_MAP: Readonly<Record<string, readonly string[]>> = {
  permissions: getSystemPermissionKeys((permission) => permission.module === 'permissions'),
  users: getSystemPermissionKeys(
    (permission) => permission.module === 'users' && (permission.action === 'read' || permission.action === 'manage'),
  ),
  // Settings room carries the global control plane (theme, locale, defaults).
  // Reading it must be enough: every client loads settings on boot to resolve
  // the theme and the locale, so requiring write rights here would lock users
  // out of the app entirely.
  settings: ['settings.read'],
};
