# Analytics

Product analytics for the admin dashboard (`/dashboard` in the web app). It answers three questions, in this order:

1. **Are we helping people?** Goals reached, form growth, personal records, races against the target, safe training load.
2. **Are people engaged?** Who trains every week, how habits form, retention.
3. **What needs an administrator?** Users likely to leave, overloaded athletes, goals at risk, broken integrations, failed notifications, stuck exports.

The north-star metric is **weekly active runners**: users with at least one completed workout in the last 7 days.

PRD: `documents/admin-analytics-backend-prd.md` and `documents/admin-analytics-frontend-prd.md`.

## API

All endpoints are admin endpoints and need the `analytics.read` permission.

| Endpoint | Block |
|---|---|
| `GET /v1/analytics/summary` | KPI cards: value, previous period, change and a spark series |
| `GET /v1/analytics/activity?range=7d\|30d\|90d` | The main chart: active users, runners, workouts and km by day |
| `GET /v1/analytics/engagement` | Regularity, habit, cohorts, sources, when people run, DAU/WAU/MAU |
| `GET /v1/analytics/outcomes` | Goals, path to the goal, form growth, records, races, safe load, volume |
| `GET /v1/analytics/plans` | Plans created and finished, where people quit, adherence by plan week |
| `GET /v1/analytics/coach` | Coach usage, proactive replies, coach on vs off, LLM cost |
| `GET /v1/analytics/audience` | Sign-ups, activation funnel, platforms, integrations, experience, languages |
| `GET /v1/analytics/attention-items` | Paged list of users that need an administrator, with counts by type |

Shared query: `period=7d|30d|90d|12m` (default `30d`), `timezone` (IANA, default `ANALYTICS_DEFAULT_TIMEZONE`), `includeStaff` (default `false`), `refresh` (skip the cache). Responses carry codes and numbers only; clients translate.

Blocks are cached in Redis for 10 minutes (attention list for 2), keyed by the filters, the current day and the data version (see Realtime).

## Realtime

The dashboard updates itself while it is open.

1. `AnalyticsRealtimeListener` hears domain events that change the numbers: workouts, plans, goals, athlete state and progress, imported activities, integrations, coach replies and notes, LLM usage, sign-ups, blocks, deletions and exports. The analytics jobs (activity, records, nightly snapshot) report their changes the same way.
2. Each change queues one delayed job on `analytics-realtime` with a fixed job id, so a burst of changes collapses into one flush at most every `ANALYTICS_REALTIME_THROTTLE_MS` (30 s).
3. The flush increments `analytics:version` in Redis and publishes `analytics.data_changed`, which is sent as `analytics.updated` (`{ version, changedAt }`) to the `analytics` room. The room needs `analytics.read`.
4. The version is part of every cache key, so blocks requested after a change are computed again, while repeated requests between changes come from the cache.
5. The web client invalidates `["analytics"]` queries on `analytics.updated`; only the blocks on screen are refetched.

## Who is counted

The `eligible` CTE (`lib/analytics-sql.ts`) is the population of every query: users that are not system and not deleted. **Staff** — holders of any `adminOnly` permission — are excluded unless `includeStaff=true`.

## Definitions

| Term | Definition |
|---|---|
| Workout | `workouts.status = 'completed'`, not `rest`, day of `completed_at` in the request timezone |
| Active user (day) | A row in `user_daily_activity` |
| Weekly active runners | Athletes with a workout in the 7 days ending at the date |
| Plan adherence | Completed / (completed + skipped) planned workouts due in the period |
| Activation | First workout within 14 days of sign-up |
| Habit | Workouts in at least 3 of the first 4 weeks after the first workout |
| Cohort retention, week N | Users registered in week K with a workout in week K+N |
| Churn risk | Active plan and no workout for 14+ days (high from 21) |
| Overload | Acute / chronic load > 1.5 (attention: 5+ days in a row) |
| Form growth | Change of threshold pace and fitness over 8 weeks, athletes with ≥ 8 workouts in that window |

Thresholds live in `analytics.constants.ts`.

### Goal progress

Judged by `GoalProgressEvaluator` (`training/goals/goal-progress.ts`) by the category of the goal type (`goal-taxonomy.ts`):

| Category | Achieved when |
|---|---|
| `race_event` | A race on the goal distance (±3%) — the plan's race workout or a logged race result — within the target time, by the target date + 7 days |
| `performance` | Target pace or continuous run reached; without a target, threshold pace (fitness for aerobic goals) better by 3% |
| `training_habit` | Weekly target (runs, km, minutes) met in 3 of the last 4 weeks, or the continuous run reached; without a target, 2+ runs a week four weeks in a row |
| `fitness_lifestyle` | Target weight reached; maintenance goals hold the weekly habit 8 weeks in a row |
| `challenge` | Challenge metric reached within its period |
| `flexible` | The plan of the goal is completed |

Statuses: `achieved`, `on_track`, `at_risk`, `missed`, `abandoned` (plan cancelled by the user or an admin), `no_data`. The nightly job stores one snapshot per goal and day in `goal_progress_snapshots`; a goal's final status is the first final snapshot.

## Data collected

| Table | Written by |
|---|---|
| `user_daily_activity` | `AnalyticsActivityInterceptor`: the first authenticated non-admin request of a user per day and platform (deduplicated in Redis), then a queue job |
| `llm_usage` | `OpenAiService` publishes `openai.usage.recorded` for calls that pass `usage: { feature, userId }`; cost is computed at write time from `LLM_PRICING` |
| `athlete_records_log` | Workout completed / imported / merged and progress changes queue a records refresh (one delayed job per athlete) |
| `goal_progress_snapshots`, `analytics_daily_metrics` | Nightly job `analytics-snapshot` (00:30 UTC): today's goal snapshots and daily metrics of the last 3 days |

## After deploy

```bash
npm run db:migrate
npx ts-node -r tsconfig-paths/register scripts/backfill-analytics.ts --from=2025-10-01
```

The backfill is idempotent: activity days from earlier traces (history, workouts, coach messages, recordings, sign-ups), the records log, daily metrics, and today's goal snapshot. Goal progress cannot be reconstructed for past days.

LLM prices: built-in for common OpenAI models; override with `LLM_PRICING` (JSON, USD per 1M tokens: `{"model": {"input": 0.15, "cachedInput": 0.075, "output": 0.6}}`). Calls of a model without a price are stored with zero cost and a warning is logged once.
