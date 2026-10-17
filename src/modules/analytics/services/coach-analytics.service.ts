import { Injectable } from '@nestjs/common';

import type { AnalyticsCoachResponseDto } from '../dto/analytics-response.dto';
import { type AnalyticsScope, dateRange, median, round1, share } from '../lib/analytics-period';
import { COMPLETED_WORKOUT, ELIGIBLE_CTE, localDay, toDateKey, toNumber, toNumberOrNull } from '../lib/analytics-sql';
import { AnalyticsDbService } from './analytics-db.service';

const PROACTIVE = `(m.metadata->>'proactive')::boolean IS TRUE`;

/** Tref, the AI coach: how people use it, whether it helps and what it costs. */
@Injectable()
export class CoachAnalyticsService {
  constructor(private readonly db: AnalyticsDbService) {}

  async coach(scope: AnalyticsScope): Promise<Omit<AnalyticsCoachResponseDto, 'generatedAt'>> {
    const [enabledShare, conversations, proactive, workoutNotes, effect, llm] = await Promise.all([
      this.enabledShare(scope),
      this.conversations(scope),
      this.proactive(scope),
      this.workoutNotes(scope),
      this.effect(scope),
      this.llm(scope),
    ]);
    return { enabledShare, ...conversations, proactive, workoutNotes, effect, llm };
  }

  private async enabledShare(scope: AnalyticsScope): Promise<number | null> {
    const row = await this.db.one<{ users: string; enabled: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COUNT(*) AS users, COUNT(*) FILTER (WHERE COALESCE(p.coach_enabled, true)) AS enabled
         FROM eligible e
         LEFT JOIN user_preferences p ON p.user_id = e.user_id`,
      scope,
    );
    return share(toNumber(row.enabled), toNumber(row.users));
  }

  private async conversations(
    scope: AnalyticsScope,
  ): Promise<Pick<AnalyticsCoachResponseDto, 'messages' | 'activeUsers' | 'messagesPerSession'>> {
    const day = localDay('m.created_at');
    const [daily, totals, perSession] = await Promise.all([
      this.db.select<{ day: unknown; user_messages: string; replies: string; proactive: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT ${day} AS day,
                COUNT(*) FILTER (WHERE m.role = 'user') AS user_messages,
                COUNT(*) FILTER (WHERE m.role = 'assistant' AND NOT ${PROACTIVE}) AS replies,
                COUNT(*) FILTER (WHERE m.role = 'assistant' AND ${PROACTIVE}) AS proactive
           FROM coach_messages m
           JOIN coach_sessions s ON s.id = m.session_id
           JOIN eligible e ON e.user_id = s.user_id
          WHERE m.deleted_at IS NULL AND ${day} BETWEEN :from AND :to
          GROUP BY 1`,
        scope,
      ),
      this.db.one<{ users: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT COUNT(DISTINCT s.user_id) AS users
           FROM coach_messages m
           JOIN coach_sessions s ON s.id = m.session_id
           JOIN eligible e ON e.user_id = s.user_id
          WHERE m.deleted_at IS NULL AND m.role = 'user' AND ${day} BETWEEN :from AND :to`,
        scope,
      ),
      this.db.select<{ messages: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT COUNT(*) AS messages
           FROM coach_messages m
           JOIN coach_sessions s ON s.id = m.session_id
           JOIN eligible e ON e.user_id = s.user_id
          WHERE m.deleted_at IS NULL AND m.role = 'user' AND ${day} BETWEEN :from AND :to
          GROUP BY m.session_id`,
        scope,
      ),
    ]);
    const byDay = new Map(daily.map((row) => [toDateKey(row.day), row]));
    const perSessionMedian = median(perSession.map((row) => toNumber(row.messages)));
    return {
      messages: dateRange(scope.from, scope.to).map((date) => ({
        date,
        userMessages: toNumber(byDay.get(date)?.user_messages),
        coachReplies: toNumber(byDay.get(date)?.replies),
        proactive: toNumber(byDay.get(date)?.proactive),
      })),
      activeUsers: toNumber(totals.users),
      messagesPerSession: perSessionMedian === null ? null : round1(perSessionMedian),
    };
  }

  /** Proactive messages of the period and whether the user wrote back within a day. */
  private async proactive(scope: AnalyticsScope): Promise<AnalyticsCoachResponseDto['proactive']> {
    const row = await this.db.one<{ sent: string; replied: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT COUNT(*) AS sent,
              COUNT(*) FILTER (WHERE EXISTS (
                SELECT 1 FROM coach_messages r
                 WHERE r.session_id = m.session_id AND r.role = 'user' AND r.deleted_at IS NULL
                   AND r.created_at > m.created_at AND r.created_at <= m.created_at + interval '24 hours'
              )) AS replied
         FROM coach_messages m
         JOIN coach_sessions s ON s.id = m.session_id
         JOIN eligible e ON e.user_id = s.user_id
        WHERE m.deleted_at IS NULL AND m.role = 'assistant' AND ${PROACTIVE}
          AND ${localDay('m.created_at')} BETWEEN :from AND :to`,
      scope,
    );
    const sent = toNumber(row.sent);
    const replied = toNumber(row.replied);
    return { sent, replied24h: replied, replyRate: share(replied, sent) };
  }

  private async workoutNotes(scope: AnalyticsScope): Promise<AnalyticsCoachResponseDto['workoutNotes']> {
    const rows = await this.db.select<{ day: unknown; notes: string }>(
      `WITH ${ELIGIBLE_CTE}
       SELECT ${localDay('n.created_at')} AS day, COUNT(*) AS notes
         FROM coach_workout_notes n
         JOIN eligible e ON e.user_id = n.user_id
        WHERE ${localDay('n.created_at')} BETWEEN :from AND :to
        GROUP BY 1`,
      scope,
    );
    const byDay = new Map(rows.map((row) => [toDateKey(row.day), toNumber(row.notes)]));
    const daily = dateRange(scope.from, scope.to).map((date) => ({ date, notes: byDay.get(date) ?? 0 }));
    return { total: daily.reduce((sum, row) => sum + row.notes, 0), daily };
  }

  /**
   * Users with the coach on vs off: plan adherence in the period, week-4
   * retention of recent sign-ups and the share of finished goals achieved.
   * A correlation only — people who keep the coach on may differ anyway.
   */
  private async effect(scope: AnalyticsScope): Promise<AnalyticsCoachResponseDto['effect']> {
    const rows = await this.db.select<{
      coach: boolean;
      done: string;
      missed: string;
      cohort: string;
      retained: string;
      achieved: string;
      finished: string;
    }>(
      `WITH ${ELIGIBLE_CTE},
       users AS (
         SELECT e.user_id, e.athlete_id, e.registered_at, COALESCE(p.coach_enabled, true) AS coach
           FROM eligible e
           LEFT JOIN user_preferences p ON p.user_id = e.user_id
       ),
       adherence AS (
         SELECT u.coach,
                COUNT(*) FILTER (WHERE w.status = 'completed') AS done,
                COUNT(*) FILTER (WHERE w.status = 'skipped') AS missed
           FROM workouts w
           JOIN users u ON u.athlete_id = w.athlete_id
          WHERE w.deleted_at IS NULL AND w.plan_id IS NOT NULL AND w.type <> 'rest'
            AND ${localDay('w.scheduled_at')} BETWEEN :from AND :to
          GROUP BY u.coach
       ),
       retention AS (
         SELECT u.coach,
                COUNT(*) AS cohort,
                COUNT(*) FILTER (WHERE EXISTS (
                  SELECT 1 FROM workouts w
                   WHERE w.athlete_id = u.athlete_id AND ${COMPLETED_WORKOUT}
                     AND w.completed_at >= u.registered_at + interval '21 days'
                     AND w.completed_at < u.registered_at + interval '28 days'
                )) AS retained
           FROM users u
          WHERE u.registered_at BETWEEN (:today::date - 118) AND (:today::date - 28)
          GROUP BY u.coach
       ),
       goals AS (
         SELECT u.coach,
                COUNT(*) FILTER (WHERE f.status = 'achieved') AS achieved,
                COUNT(*) AS finished
           FROM (
             SELECT DISTINCT ON (s.goal_id) s.goal_id, s.athlete_id, s.status, s.date
               FROM goal_progress_snapshots s
              WHERE s.status IN ('achieved', 'missed', 'abandoned')
              ORDER BY s.goal_id, s.date
           ) f
           JOIN users u ON u.athlete_id = f.athlete_id
          WHERE f.date >= (:today::date - 365)
          GROUP BY u.coach
       )
       SELECT c.coach, a.done, a.missed, r.cohort, r.retained, g.achieved, g.finished
         FROM (VALUES (true), (false)) AS c(coach)
         LEFT JOIN adherence a ON a.coach = c.coach
         LEFT JOIN retention r ON r.coach = c.coach
         LEFT JOIN goals g ON g.coach = c.coach`,
      scope,
    );
    type Row = (typeof rows)[number];
    const of = (coach: boolean): Row | undefined => rows.find((row) => row.coach === coach);
    const metric = (pick: (row: Row) => number | null): { enabled: number | null; disabled: number | null } => {
      const enabled = of(true);
      const disabled = of(false);
      return { enabled: enabled ? pick(enabled) : null, disabled: disabled ? pick(disabled) : null };
    };
    return [
      {
        metric: 'plan_adherence',
        ...metric((row) => share(toNumber(row.done), toNumber(row.done) + toNumber(row.missed))),
      },
      { metric: 'week4_retention', ...metric((row) => share(toNumber(row.retained), toNumber(row.cohort))) },
      { metric: 'goals_achieved', ...metric((row) => share(toNumber(row.achieved), toNumber(row.finished))) },
    ];
  }

  private async llm(scope: AnalyticsScope): Promise<AnalyticsCoachResponseDto['llm']> {
    const day = localDay('l.created_at');
    const [totals, daily, byFeature, byModel, activeUsers] = await Promise.all([
      this.db.one<{ calls: string; failed: string; cost: string; input: string; output: string; p95: string | null }>(
        `SELECT COUNT(*) AS calls,
                COUNT(*) FILTER (WHERE l.status = 'failed') AS failed,
                COALESCE(SUM(l.cost_usd), 0) AS cost,
                COALESCE(SUM(l.input_tokens), 0) AS input,
                COALESCE(SUM(l.output_tokens), 0) AS output,
                percentile_cont(0.95) WITHIN GROUP (ORDER BY l.latency_ms) FILTER (WHERE l.status <> 'failed') AS p95
           FROM llm_usage l
          WHERE ${day} BETWEEN :from AND :to`,
        scope,
      ),
      this.db.select<{ day: unknown; cost: string; calls: string }>(
        `SELECT ${day} AS day, SUM(l.cost_usd) AS cost, COUNT(*) AS calls
           FROM llm_usage l
          WHERE ${day} BETWEEN :from AND :to
          GROUP BY 1`,
        scope,
      ),
      this.db.select<{ key: string; calls: string; cost: string; input: string; output: string }>(
        `SELECT l.feature AS key, COUNT(*) AS calls, SUM(l.cost_usd) AS cost,
                SUM(l.input_tokens) AS input, SUM(l.output_tokens) AS output
           FROM llm_usage l
          WHERE ${day} BETWEEN :from AND :to
          GROUP BY 1 ORDER BY SUM(l.cost_usd) DESC`,
        scope,
      ),
      this.db.select<{ key: string; calls: string; cost: string; input: string; output: string }>(
        `SELECT l.model AS key, COUNT(*) AS calls, SUM(l.cost_usd) AS cost,
                SUM(l.input_tokens) AS input, SUM(l.output_tokens) AS output
           FROM llm_usage l
          WHERE ${day} BETWEEN :from AND :to
          GROUP BY 1 ORDER BY SUM(l.cost_usd) DESC`,
        scope,
      ),
      this.db.one<{ users: string }>(
        `WITH ${ELIGIBLE_CTE}
         SELECT COUNT(DISTINCT a.user_id) AS users
           FROM user_daily_activity a
          WHERE a.date BETWEEN :from AND :to AND a.user_id IN (SELECT user_id FROM eligible)`,
        scope,
      ),
    ]);
    const money = (value: unknown): number => Math.round(toNumber(value) * 100) / 100;
    const calls = toNumber(totals.calls);
    const cost = toNumber(totals.cost);
    const users = toNumber(activeUsers.users);
    const byDay = new Map(daily.map((row) => [toDateKey(row.day), row]));
    const breakdown = (rows: typeof byFeature): AnalyticsCoachResponseDto['llm']['byFeature'] =>
      rows.map((row) => ({
        key: row.key,
        calls: toNumber(row.calls),
        costUsd: money(row.cost),
        inputTokens: toNumber(row.input),
        outputTokens: toNumber(row.output),
      }));
    const p95 = toNumberOrNull(totals.p95);
    return {
      costUsd: money(cost),
      costPerActiveUserUsd: users ? Math.round((cost / users) * 1000) / 1000 : null,
      calls,
      inputTokens: toNumber(totals.input),
      outputTokens: toNumber(totals.output),
      failedShare: share(toNumber(totals.failed), calls),
      p95LatencyMs: p95 === null ? null : Math.round(p95),
      daily: dateRange(scope.from, scope.to).map((date) => ({
        date,
        costUsd: money(byDay.get(date)?.cost),
        calls: toNumber(byDay.get(date)?.calls),
      })),
      byFeature: breakdown(byFeature),
      byModel: breakdown(byModel),
    };
  }
}
