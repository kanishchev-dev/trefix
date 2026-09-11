import { getSystemPermissionKeys } from '@/modules/permissions/constants/system-access.constants';

export const REALTIME_ROOM_PERMISSION_MAP: Readonly<Record<string, readonly string[]>> = {
  permissions: getSystemPermissionKeys((permission) => permission.domain === 'permissions'),
  users: getSystemPermissionKeys(
    (permission) => permission.domain === 'users' && (permission.action === 'read' || permission.action === 'manage'),
  ),
};
