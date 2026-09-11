export interface SystemPermissionDefinition {
  readonly key: string;
  readonly domain: string;
  readonly action: string;
  readonly description: string;
}

export interface SystemPermissionGroupDefinition {
  readonly systemKey: string;
  readonly name: string;
  readonly description: string;
  readonly permissionKeys: readonly string[];
}

export interface SystemAdminUserDefinition {
  readonly systemKey: string;
  readonly firstName: string;
  readonly lastName: string;
}

export const SYSTEM_PERMISSION_CATALOG: readonly SystemPermissionDefinition[] = [
  {
    key: 'permissions.read',
    domain: 'permissions',
    action: 'read',
    description: 'Read permission catalog',
  },
  {
    key: 'permissions.manage',
    domain: 'permissions',
    action: 'manage',
    description: 'Manage permission catalog',
  },
  {
    key: 'users.read',
    domain: 'users',
    action: 'read',
    description: 'Read user profiles and lists',
  },
  {
    key: 'users.manage',
    domain: 'users',
    action: 'manage',
    description: 'Manage user accounts',
  },
  {
    key: 'users.create',
    domain: 'users',
    action: 'create',
    description: 'Create user accounts',
  },
  {
    key: 'users.update',
    domain: 'users',
    action: 'update',
    description: 'Update user accounts',
  },
  {
    key: 'users.delete',
    domain: 'users',
    action: 'delete',
    description: 'Delete user accounts',
  },
] as const;

export const SYSTEM_PERMISSION_KEYS = SYSTEM_PERMISSION_CATALOG.map((permission) => permission.key);

export const SYSTEM_PERMISSION_GROUPS: readonly SystemPermissionGroupDefinition[] = [
  {
    systemKey: 'system.administrators',
    name: 'Администраторы',
    description: 'System group with full access to every registered permission',
    permissionKeys: SYSTEM_PERMISSION_KEYS,
  },
  {
    systemKey: 'system.registered-users',
    name: 'Зарегистрированные пользователи',
    description: 'System group for authenticated users',
    permissionKeys: ['users.read'],
  },
] as const;

export const SYSTEM_ADMIN_USER: SystemAdminUserDefinition = {
  systemKey: 'system.admin',
  firstName: 'System',
  lastName: 'Administrator',
};

export const getSystemPermissionKeys = (predicate: (permission: SystemPermissionDefinition) => boolean): string[] =>
  SYSTEM_PERMISSION_CATALOG.filter(predicate).map((permission) => permission.key);
