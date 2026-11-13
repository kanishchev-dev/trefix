/**
 * Single source of truth for the permissions that guard the API.
 *
 * Every `@RequirePermissions(...)` in the codebase must reference a key that
 * exists in `SYSTEM_PERMISSION_CATALOG`, and every key in the catalog must be
 * referenced by at least one endpoint. The catalog is seeded into the database
 * on bootstrap, which is what the admin panel renders as toggleable switches.
 *
 * Naming convention: `<module>.<resource>.<action>`. Modules with a single
 * resource omit it (`settings.read`). `SYSTEM_PERMISSION_CATALOG` is grouped by
 * the first segment in the admin UI, so the first segment must stay stable.
 */
export interface SystemPermissionDefinition {
  readonly key: string;
  readonly module: string;
  readonly resource: string;
  readonly action: string;
  readonly description: string;
  /** Admin-panel capability: never granted to ordinary accounts by default. */
  readonly adminOnly?: true;
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
  // ---------------------------------------------------------------- access
  {
    key: 'permissions.read',
    adminOnly: true,
    module: 'permissions',
    resource: '',
    action: 'read',
    description: 'View the permission catalog, permission groups and effective user permissions',
  },
  {
    key: 'permissions.manage',
    adminOnly: true,
    module: 'permissions',
    resource: '',
    action: 'manage',
    description: 'Create, edit and delete permissions and groups, and assign them to users and new accounts',
  },

  // ----------------------------------------------------------------- users
  {
    key: 'users.read',
    module: 'users',
    resource: '',
    action: 'read',
    description: 'View the user list and individual user profiles',
  },
  {
    key: 'users.create',
    adminOnly: true,
    module: 'users',
    resource: '',
    action: 'create',
    description: 'Create user accounts from the admin panel',
  },
  {
    key: 'users.update',
    adminOnly: true,
    module: 'users',
    resource: '',
    action: 'update',
    description: 'Edit user profiles and status',
  },
  {
    key: 'users.delete',
    adminOnly: true,
    module: 'users',
    resource: '',
    action: 'delete',
    description: 'Delete user accounts permanently',
  },
  {
    key: 'users.manage',
    adminOnly: true,
    module: 'users',
    resource: '',
    action: 'manage',
    description: 'Manage user access: send activation invites, assign groups and individual rights',
  },
  {
    key: 'users.activity.read',
    adminOnly: true,
    module: 'users',
    resource: 'activity',
    action: 'read',
    description: 'View and export the action history of any user',
  },
  {
    key: 'users.security.read',
    adminOnly: true,
    module: 'users',
    resource: 'security',
    action: 'read',
    description: 'View account status, sessions, sign-in methods, consents and data exports of any user',
  },
  {
    key: 'users.security.manage',
    adminOnly: true,
    module: 'users',
    resource: 'security',
    action: 'manage',
    description:
      'Block and unblock users, end sessions, change sign-in methods and email, request data exports, delete and restore accounts',
  },

  // -------------------------------------------------------------- settings
  {
    key: 'settings.read',
    module: 'settings',
    resource: '',
    action: 'read',
    description: 'View global application settings: theme, locale and defaults for new accounts',
  },
  {
    key: 'settings.update',
    adminOnly: true,
    module: 'settings',
    resource: '',
    action: 'update',
    description: 'Change global application settings and defaults for new accounts',
  },

  // --------------------------------------------------------------- storage
  {
    key: 'storage.read',
    module: 'storage',
    resource: '',
    action: 'read',
    description: 'Download uploaded files such as avatars and attachments',
  },
  {
    key: 'storage.create',
    module: 'storage',
    resource: '',
    action: 'create',
    description: 'Upload files to storage',
  },
  {
    key: 'storage.delete',
    module: 'storage',
    resource: '',
    action: 'delete',
    description: 'Delete files from storage',
  },

  // ---------------------------------------------------------- integrations
  {
    key: 'integrations.read',
    module: 'integrations',
    resource: '',
    action: 'read',
    description: 'View connected integrations, their status and the OAuth connection link',
  },
  {
    key: 'integrations.sync',
    module: 'integrations',
    resource: '',
    action: 'sync',
    description: 'Trigger a manual data sync with an external service such as Strava',
  },
  {
    key: 'integrations.delete',
    module: 'integrations',
    resource: '',
    action: 'delete',
    description: 'Disconnect an integration and revoke its access to user data',
  },

  // --------------------------------------------------------------- account
  {
    key: 'account.update',
    module: 'account',
    resource: '',
    action: 'update',
    description: 'Edit the own profile: first name, last name and locale',
  },
  {
    key: 'account.preferences.read',
    module: 'account',
    resource: 'preferences',
    action: 'read',
    description: 'View own app preferences: units, week start, time format and AI coach settings',
  },
  {
    key: 'account.preferences.update',
    module: 'account',
    resource: 'preferences',
    action: 'update',
    description: 'Change own app preferences, including turning the AI coach on or off',
  },
  {
    key: 'account.delete',
    module: 'account',
    resource: '',
    action: 'delete',
    description: 'Delete the own account and all its data permanently',
  },

  // ----------------------------------------------------------------- coach
  {
    key: 'coach.sessions.read',
    module: 'coach',
    resource: 'sessions',
    action: 'read',
    description: 'View coaching sessions, their messages and the streaming answer',
  },
  {
    key: 'coach.sessions.create',
    module: 'coach',
    resource: 'sessions',
    action: 'create',
    description: 'Start a new coaching session with the AI coach',
  },
  {
    key: 'coach.sessions.message',
    module: 'coach',
    resource: 'sessions',
    action: 'message',
    description: 'Send messages to the AI coach and receive answers',
  },
  {
    key: 'coach.sessions.delete',
    module: 'coach',
    resource: 'sessions',
    action: 'delete',
    description: 'Clear the own chat history with the AI coach',
  },

  // -------------------------------------------------------------- training
  {
    key: 'training.athletes.read',
    module: 'training',
    resource: 'athletes',
    action: 'read',
    description: 'View the athlete profile and the latest calculated athlete state',
  },
  {
    key: 'training.athletes.create',
    module: 'training',
    resource: 'athletes',
    action: 'create',
    description: 'Create an athlete profile and fill in the training input data',
  },
  {
    key: 'training.athletes.update',
    module: 'training',
    resource: 'athletes',
    action: 'update',
    description: 'Edit the own athlete profile: body, heart rate and zones, schedule, experience',
  },
  {
    key: 'training.gear.read',
    module: 'training',
    resource: 'gear',
    action: 'read',
    description: 'View own running gear with its mileage',
  },
  {
    key: 'training.gear.manage',
    module: 'training',
    resource: 'gear',
    action: 'manage',
    description: 'Add, edit, retire and delete own running gear and assign it to workouts',
  },
  {
    key: 'training.progress.read',
    module: 'training',
    resource: 'progress',
    action: 'read',
    description: 'View the progress snapshot: load, form and recovery trends',
  },
  {
    key: 'training.progress.manage',
    module: 'training',
    resource: 'progress',
    action: 'manage',
    description: 'Add own race results and exclude erroneous workouts from records',
  },
  {
    key: 'training.goals.read',
    module: 'training',
    resource: 'goals',
    action: 'read',
    description: 'View training goals',
  },
  {
    key: 'training.goals.create',
    module: 'training',
    resource: 'goals',
    action: 'create',
    description: 'Create and adjust training goals',
  },
  {
    key: 'training.plans.read',
    module: 'training',
    resource: 'plans',
    action: 'read',
    description: 'View training plans, the mobile overview and manual plan previews',
  },
  {
    key: 'training.plans.create',
    module: 'training',
    resource: 'plans',
    action: 'create',
    description: 'Build a training plan manually or generate one automatically',
  },
  {
    key: 'training.plans.update',
    module: 'training',
    resource: 'plans',
    action: 'update',
    description: 'Regenerate a training plan and change its weeks and volume',
  },
  {
    key: 'training.plans.delete',
    module: 'training',
    resource: 'plans',
    action: 'delete',
    description: 'Delete draft and history training plans',
  },
  {
    key: 'training.workouts.read',
    module: 'training',
    resource: 'workouts',
    action: 'read',
    description: 'View the workout list for a period and individual workouts',
  },
  {
    key: 'training.workouts.create',
    module: 'training',
    resource: 'workouts',
    action: 'create',
    description: 'Create or log a workout manually',
  },
  {
    key: 'training.workouts.update',
    module: 'training',
    resource: 'workouts',
    action: 'update',
    description: 'Complete a workout and record its actual result; change a workout added by hand',
  },
  {
    key: 'training.workouts.delete',
    module: 'training',
    resource: 'workouts',
    action: 'delete',
    description: 'Remove a planned workout added by hand',
  },
  {
    key: 'training.calendar.read',
    adminOnly: true,
    module: 'training',
    resource: 'calendar',
    action: 'read',
    description: 'View the workout calendar of any user in the admin panel',
  },
  {
    key: 'training.calendar.manage',
    adminOnly: true,
    module: 'training',
    resource: 'calendar',
    action: 'manage',
    description: 'Add and edit workouts in the calendar of any user from the admin panel',
  },
  {
    key: 'training.userplans.read',
    adminOnly: true,
    module: 'training',
    resource: 'userplans',
    action: 'read',
    description: 'View training plans of any user in the admin panel, with diffs and previews',
  },
  {
    key: 'training.userplans.manage',
    adminOnly: true,
    module: 'training',
    resource: 'userplans',
    action: 'manage',
    description: 'Create, edit, start, cancel, delete and rebuild training plans of any user from the admin panel',
  },
  {
    key: 'training.userathletes.read',
    adminOnly: true,
    module: 'training',
    resource: 'userathletes',
    action: 'read',
    description: 'View the athlete profile and zones of any user in the admin panel',
  },
  {
    key: 'training.userathletes.manage',
    adminOnly: true,
    module: 'training',
    resource: 'userathletes',
    action: 'manage',
    description: 'Edit the athlete profile, zones and availability of any user from the admin panel',
  },
  {
    key: 'training.userprogress.read',
    adminOnly: true,
    module: 'training',
    resource: 'userprogress',
    action: 'read',
    description: 'View progress, records and race results of any user in the admin panel',
  },
  {
    key: 'training.userprogress.manage',
    adminOnly: true,
    module: 'training',
    resource: 'userprogress',
    action: 'manage',
    description: 'Add and delete race results of any user from the admin panel',
  },
  {
    key: 'training.usergear.read',
    adminOnly: true,
    module: 'training',
    resource: 'usergear',
    action: 'read',
    description: 'View shoes and devices of any user in the admin panel',
  },
  {
    key: 'training.usergear.manage',
    adminOnly: true,
    module: 'training',
    resource: 'usergear',
    action: 'manage',
    description: 'Add, edit, archive and delete gear of any user from the admin panel',
  },
  {
    key: 'training.analyze',
    module: 'training',
    resource: '',
    action: 'analyze',
    description: 'Run a detailed AI analysis of a completed workout',
  },
  {
    key: 'training.adapt',
    module: 'training',
    resource: '',
    action: 'adapt',
    description: 'Adapt the current training plan to the athlete state and recovery',
  },
  {
    key: 'integrations.users.read',
    adminOnly: true,
    module: 'integrations',
    resource: 'users',
    action: 'read',
    description: 'View integrations of any user in the admin panel',
  },
  {
    key: 'integrations.users.manage',
    adminOnly: true,
    module: 'integrations',
    resource: 'users',
    action: 'manage',
    description: 'Sync and disconnect integrations of any user from the admin panel',
  },
  {
    key: 'coach.users.read',
    adminOnly: true,
    module: 'coach',
    resource: 'users',
    action: 'read',
    description: 'View the AI coach session list and workout notes of any user',
  },
  {
    key: 'coach.users.manage',
    adminOnly: true,
    module: 'coach',
    resource: 'users',
    action: 'manage',
    description: 'Delete AI coach conversations and regenerate or delete workout notes of any user',
  },
  {
    key: 'coach.conversations.read',
    adminOnly: true,
    module: 'coach',
    resource: 'conversations',
    action: 'read',
    description: 'Read AI coach conversations of any user (debugging; every view is logged)',
  },
  // --------------------------------------------------------- notifications
  {
    key: 'notifications.read',
    module: 'notifications',
    resource: '',
    action: 'read',
    description: 'View own notifications and the number of unread ones',
  },
  {
    key: 'notifications.manage',
    module: 'notifications',
    resource: '',
    action: 'manage',
    description: 'Mark own notifications as read, remove them and register the app for push notifications',
  },
  {
    key: 'notifications.users.read',
    adminOnly: true,
    module: 'notifications',
    resource: 'users',
    action: 'read',
    description: 'View notifications of any user with their delivery status, and the devices that receive pushes',
  },
  {
    key: 'notifications.broadcasts.read',
    adminOnly: true,
    module: 'notifications',
    resource: 'broadcasts',
    action: 'read',
    description: 'View notifications sent from the admin panel, their recipients and delivery stats',
  },
  {
    key: 'notifications.broadcasts.send',
    adminOnly: true,
    module: 'notifications',
    resource: 'broadcasts',
    action: 'send',
    description: 'Send notifications to a user, a group, a segment or all users by inbox, push and email',
  },
  // ----------------------------------------------------------------- audit
  {
    key: 'audit.read',
    adminOnly: true,
    module: 'audit',
    resource: '',
    action: 'read',
    description: 'View and export the log of actions of all administrators and users',
  },
  // ------------------------------------------------------------- analytics
  {
    key: 'analytics.read',
    adminOnly: true,
    module: 'analytics',
    resource: '',
    action: 'read',
    description: 'View the product analytics dashboard',
  },
] as const;

export const SYSTEM_PERMISSION_KEYS = SYSTEM_PERMISSION_CATALOG.map((permission) => permission.key);

/**
 * Permissions granted to every account out of the box.
 *
 * Covers the whole self-service surface used by the mobile app (athlete data,
 * plans, workouts, AI coach, integrations, files) plus the read-only settings
 * the application shell needs. Everything marked `adminOnly` is excluded:
 * admin-panel capabilities are granted explicitly.
 */
export const DEFAULT_USER_PERMISSION_KEYS: readonly string[] = SYSTEM_PERMISSION_CATALOG.filter(
  (permission) => !permission.adminOnly,
).map((permission) => permission.key);

/**
 * System groups.
 *
 * `name` and `description` are stored in the database and rendered as the
 * fallback text, so they are written in Russian — the same language as the
 * group names themselves. Localized variants of a system group are a separate
 * concern (see the permission descriptions below for how translations are
 * handled today); these strings only have to be readable.
 */
export const SYSTEM_PERMISSION_GROUPS: readonly SystemPermissionGroupDefinition[] = [
  {
    systemKey: 'system.administrators',
    name: 'Администраторы',
    description: 'Системная группа с полным доступом ко всем правам',
    permissionKeys: SYSTEM_PERMISSION_KEYS,
  },
  {
    systemKey: 'system.registered-users',
    name: 'Зарегистрированные пользователи',
    description: 'Системная группа для авторизованных пользователей',
    permissionKeys: DEFAULT_USER_PERMISSION_KEYS,
  },
] as const;

export const SYSTEM_ADMIN_USER: SystemAdminUserDefinition = {
  systemKey: 'system.admin',
  firstName: 'System',
  lastName: 'Administrator',
};

export const getSystemPermissionKeys = (predicate: (permission: SystemPermissionDefinition) => boolean): string[] =>
  SYSTEM_PERMISSION_CATALOG.filter(predicate).map((permission) => permission.key);
