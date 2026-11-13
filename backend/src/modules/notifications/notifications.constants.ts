import type { NotificationFlag, PreferenceLanguage } from '@/modules/users/users.constants';

/** Sections of the inbox; clients pick the icon and the sender label by category. */
export const NOTIFICATION_CATEGORIES = ['coach', 'admin', 'workouts', 'plans', 'progress', 'account'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

/** Delivery channels besides the inbox, which every notification gets. */
export const NOTIFICATION_CHANNELS = ['push', 'email'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_DELIVERY_STATUSES = ['pending', 'sent', 'delivered', 'failed', 'skipped'] as const;
export type NotificationDeliveryStatus = (typeof NOTIFICATION_DELIVERY_STATUSES)[number];

/** Why a delivery was skipped or failed; clients translate the code. */
export const NOTIFICATION_DELIVERY_ERRORS = [
  'no_devices',
  'preference_off',
  'device_not_registered',
  'provider_error',
  'invalid_recipient',
  'mail_error',
  'push_disabled',
] as const;
export type NotificationDeliveryError = (typeof NOTIFICATION_DELIVERY_ERRORS)[number];

export const PUSH_PLATFORMS = ['ios', 'android'] as const;
export type PushPlatform = (typeof PUSH_PLATFORMS)[number];

/**
 * Where the app opens when the notification is tapped. `id` points at the
 * entity of the target (coach session, workout, plan); `url` is only for `url`.
 */
export const NOTIFICATION_LINK_TARGETS = ['coach', 'today', 'workout', 'plan', 'progress', 'profile', 'url'] as const;
export type NotificationLinkTarget = (typeof NOTIFICATION_LINK_TARGETS)[number];

export interface NotificationLink {
  target: NotificationLinkTarget;
  id?: string | null;
  url?: string | null;
}

export interface NotificationText {
  title?: string | null;
  body: string;
}

/** Text per language; the reader gets their language or the first available one. */
export type NotificationContent = Partial<Record<PreferenceLanguage, NotificationText>>;

/**
 * Every kind of notification the system sends. A type with `preferenceFlag`
 * reaches push and email only while the user keeps that flag on in the
 * notification settings; the inbox always gets it.
 */
export interface NotificationTypeDefinition {
  category: NotificationCategory;
  preferenceFlag: NotificationFlag | null;
  /** Channels used when the sender does not choose them. */
  defaultChannels: readonly NotificationChannel[];
}

export const NOTIFICATION_TYPES = {
  /** A message the coach started on its own; the text lives in the chat. */
  'coach.message': { category: 'coach', preferenceFlag: null, defaultChannels: ['push'] },
  /** Written by an administrator; channels are chosen when sending. */
  'admin.message': { category: 'admin', preferenceFlag: null, defaultChannels: [] },
} as const satisfies Record<string, NotificationTypeDefinition>;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;
export const NOTIFICATION_TYPE_KEYS = Object.keys(NOTIFICATION_TYPES) as NotificationType[];

/** Who an admin broadcast goes to. */
export const BROADCAST_AUDIENCE_TYPES = ['users', 'group', 'all', 'segment'] as const;
export type BroadcastAudienceType = (typeof BROADCAST_AUDIENCE_TYPES)[number];

export const BROADCAST_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;
export type BroadcastStatus = (typeof BROADCAST_STATUSES)[number];

export const NOTIFICATION_TITLE_MAX_LENGTH = 120;
export const NOTIFICATION_BODY_MAX_LENGTH = 2000;
export const NOTIFICATION_URL_MAX_LENGTH = 500;
export const BROADCAST_USERS_MAX = 1000;

export const NOTIFICATIONS_PAGE_LIMIT_DEFAULT = 30;

/** Inbox entries older than this are removed by the daily retention job. */
export const NOTIFICATIONS_RETENTION_DAYS = 180;

/** Language of texts for a user with no language in the app and no device locale. */
export const NOTIFICATIONS_FALLBACK_LANGUAGE: PreferenceLanguage = 'ru';

export const NOTIFICATIONS_DELIVERY_QUEUE = 'notifications-delivery';
export const NOTIFICATIONS_DELIVER_JOB = 'notifications.deliver';
export const NOTIFICATIONS_RECEIPTS_JOB = 'notifications.receipts';
export const NOTIFICATIONS_BROADCAST_QUEUE = 'notifications-broadcast';
export const NOTIFICATIONS_BROADCAST_JOB = 'notifications.broadcast';
export const NOTIFICATIONS_RETENTION_QUEUE = 'notifications-retention';
export const NOTIFICATIONS_RETENTION_JOB = 'notifications.retention';

/** Expo makes receipts available within ~15 minutes after sending. */
export const PUSH_RECEIPTS_DELAY_MS = 15 * 60 * 1000;
/** Expo accepts at most 100 messages and 1000 receipt ids per request. */
export const EXPO_PUSH_CHUNK_SIZE = 100;
export const EXPO_RECEIPTS_CHUNK_SIZE = 1000;
export const EXPO_PUSH_SEND_URL = 'https://exp.host/--/api/v2/push/send';
export const EXPO_PUSH_RECEIPTS_URL = 'https://exp.host/--/api/v2/push/getReceipts';

/** Recipients created per insert while expanding a broadcast. */
export const BROADCAST_BATCH_SIZE = 500;

/** Realtime events sent to the recipient's room. */
export const NOTIFICATIONS_REALTIME_EVENTS = {
  CREATED: 'notifications.created',
  UPDATED: 'notifications.updated',
} as const;

export interface BroadcastSegment {
  languages?: PreferenceLanguage[];
  /** Users with at least one push device of these platforms. */
  platforms?: PushPlatform[];
  /** ISO dates, inclusive. */
  registeredFrom?: string;
  registeredTo?: string;
  /** `true` — only users with an active plan, `false` — only users without one. */
  activePlan?: boolean;
}

export interface BroadcastAudience {
  type: BroadcastAudienceType;
  userIds?: string[];
  groupId?: string;
  segment?: BroadcastSegment;
}
