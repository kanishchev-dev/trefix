# Activity history

Records what happens to a user's data — by the user, an administrator, an
integration, the system or the AI coach — and serves it to the admin panel.

## How an entry is produced

1. A service emits a domain event as usual (`eventEmitter.emit(...)`).
2. `ActivityListener` receives every event (`onAny`), looks it up in
   `ACTIVITY_EVENT_REGISTRY` and reads the actor from the request context
   (`common/context/activity-context.ts`).
3. The entry is queued (`activity-write`) and written to `activity_events` by
   `ActivityWriterProcessor`; training events are resolved from the athlete to
   the user there.

The table is append-only. `activity-retention` removes ordinary entries after
`ACTIVITY_RETENTION_DAYS` (default 730); admin actions and data access are kept.
A purged account (`account.purged`) takes its history with it.

## Who the actor is

| Situation | Actor |
|---|---|
| Authenticated request | `user` |
| Controller or handler marked `@AdminEndpoint()` | `admin` |
| Unauthenticated request (sign-up, sign-in, password reset) | `user`, the subject itself |
| Code wrapped in `runWithActivityContext({ actorType: 'integration', provider })` | `integration` |
| Background job without a context | `system` |
| Descriptor with `actorType` (imports, coach notes, adaptations proposed) | that actor, always |

`ActivityContextInterceptor` fills the context after authentication: actor,
`source` (`mobile` / `web` / `admin`), IP and the `x-client-*` headers.

## Adding a domain event

Every value of the `*_EVENTS` constants must be either described in
`ACTIVITY_EVENT_REGISTRY` or listed in `ACTIVITY_IGNORED_EVENTS`; the registry
spec fails otherwise. A descriptor gives the section (`domain`), the subject
(`{ userId }` or `{ athleteId }`), the entity, and optionally `changes`
(before/after, built with `diffFields`) and `metadata` (short labels only —
never secrets or message text). Clients translate entries by `action` and
`metadata`; the backend sends no display text.

## Sensitive data access

Admin endpoints that return sensitive data are marked
`@LogDataAccess({ resource, resourceParam })`; after a successful response the
access is recorded as `admin.data_accessed`, at most once per 10 minutes per
admin and resource.

## API

| Endpoint | Permission |
|---|---|
| `GET /v1/users/:userId/activity` | `users.activity.read` |
| `GET /v1/users/:userId/activity/export` (CSV) | `users.activity.read` |
| `GET /v1/activity?kind=admin\|data_access\|all` | `audit.read` |
| `GET /v1/activity/export` (CSV) | `audit.read` |

Pages use an opaque keyset cursor (`nextCursor`).
