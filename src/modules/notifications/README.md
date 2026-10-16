# Notifications

The user's inbox and the delivery of notifications by push (Expo) and email.
Sources: the AI coach (messages it starts on its own), administrators
(broadcasts) and, later, the system (reminders, missed workouts, achievements).

## Sending

`NotificationSenderService.notify()` / `notifyMany()` is the only entry point
(exported by the module). Every notification is stored in the inbox
(`notifications`); push and email are planned per channel as rows of
`notification_deliveries` and sent by the `notifications-delivery` queue.

| Delivery status | Meaning |
|---|---|
| `pending` | queued |
| `skipped` | not sent: `no_devices`, `preference_off`, `push_disabled` |
| `sent` | handed to Expo / the mail server |
| `delivered` | push confirmed by Apple/Google (Expo receipt, ~15 min later) |
| `failed` | `device_not_registered`, `provider_error`, `invalid_recipient` |

A type is described once in `NOTIFICATION_TYPES` (`notifications.constants.ts`):
its inbox category, default channels and the setting from
`preferences.notifications` that gates push and email. The inbox always gets
the entry. Texts written by a person (admin) or rendered once (coach) are kept
per language in `content`; system types will carry `params` and be translated
by the clients.

Push texts are rendered per device: the user's app language, then the device
locale, then Russian. A missing title falls back to the sender of the category
(`i18n/*/notifications.json`).

## Devices

The app registers its Expo token with `PUT /v1/notifications/devices` on every
start. A device is bound to the auth session: when the session is revoked
(sign-out, block, password change) the device is removed. Tokens that Expo
reports as `DeviceNotRegistered` are removed too.

## Coach

`CoachProactiveService` emits `coach.proactive_message.sent`; the listener
stores an inbox entry pointing at the chat (`link.target = coach`) and pushes
it. Quiet hours and the coach switch are already applied by the coach.

## Broadcasts

An administrator sends to `users` (up to 1000 ids), a permission `group`,
`all` users or a `segment` (app language, push platform, registration dates,
active plan). Deleted, blocked and system accounts are always excluded. The
broadcast is stored and expanded by the `notifications-broadcast` queue in
batches; a retried job skips recipients that already got it.

## API

| Endpoint | Permission |
|---|---|
| `GET /v1/notifications` | `notifications.read` |
| `GET /v1/notifications/unread-count` | `notifications.read` |
| `POST /v1/notifications/read`, `POST /v1/notifications/read-all` | `notifications.manage` |
| `DELETE /v1/notifications/:id` | `notifications.manage` |
| `PUT /v1/notifications/devices`, `POST /v1/notifications/devices/unregister` | `notifications.manage` |
| `GET /v1/users/:userId/notifications`, `GET …/notifications/devices` | `notifications.users.read` |
| `GET /v1/notification-broadcasts`, `GET …/:id`, `GET …/:id/recipients` | `notifications.broadcasts.read` |
| `POST /v1/notification-broadcasts`, `POST …/audience-preview` | `notifications.broadcasts.send` |

Realtime events to the user's room: `notifications.created`
(`{ id, unreadCount }`) and `notifications.updated` (`{ unreadCount }`).

## Configuration

| Variable | Default | |
|---|---|---|
| `EXPO_ACCESS_TOKEN` | — | needed only with "Enhanced push security" in the Expo project |
| `NOTIFICATIONS_PUSH_ENABLED` | `true` | `false` marks pushes as skipped (`push_disabled`) |

Inbox entries are removed after 180 days by the daily `notifications-retention` job.
