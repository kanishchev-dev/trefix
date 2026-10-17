/**
 * Fills the analytics tables with history that existed before tracking:
 * activity days, the personal records log, daily metrics and today's goal
 * snapshot. Idempotent: every step merges or skips what is already there.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-analytics.ts [--from=YYYY-MM-DD] [--only=activity,records,metrics,goals]
 */
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/sequelize';
import { QueryTypes } from 'sequelize';
import type { Sequelize } from 'sequelize-typescript';

import { AppModule } from '../src/app.module';
import { ActivityTrackingService } from '../src/modules/analytics/services/activity-tracking.service';
import { RecordsLogService } from '../src/modules/analytics/services/records-log.service';
import { SnapshotService } from '../src/modules/analytics/services/snapshot.service';

const STEPS = ['activity', 'records', 'metrics', 'goals'] as const;
const DAY_MS = 86_400_000;

function arg(name: string): string | undefined {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.split('=')[1];
}

/* eslint-disable no-console -- a command-line script reports to the terminal */
async function main(): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const from = arg('from') ?? new Date(Date.now() - 365 * DAY_MS).toISOString().slice(0, 10);
  const only = new Set(arg('only')?.split(',') ?? STEPS);
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    if (only.has('activity')) {
      const started = Date.now();
      const rows = await app.get(ActivityTrackingService).backfill(from);
      console.log(`activity: ${rows} days of users since ${from} (${Date.now() - started} ms)`);
    }
    if (only.has('records')) {
      const started = Date.now();
      const sequelize = app.get<Sequelize>(getConnectionToken());
      const athletes = await sequelize.query<{ id: string }>(
        `SELECT DISTINCT athlete_id AS id FROM workouts WHERE status = 'completed' AND deleted_at IS NULL
         UNION SELECT DISTINCT athlete_id FROM race_results WHERE deleted_at IS NULL`,
        { type: QueryTypes.SELECT },
      );
      const records = app.get(RecordsLogService);
      let inserted = 0;
      for (const athlete of athletes) {
        inserted += await records.refresh({ athleteId: athlete.id });
      }
      console.log(`records: ${inserted} record moments checked for ${athletes.length} athletes (${Date.now() - started} ms)`);
    }
    const snapshots = app.get(SnapshotService);
    if (only.has('metrics')) {
      const started = Date.now();
      const days = await snapshots.computeDailyMetrics(from, today);
      console.log(`metrics: ${days} days (${Date.now() - started} ms)`);
    }
    if (only.has('goals')) {
      const started = Date.now();
      // Goal progress cannot be judged for past days: only today's snapshot is made.
      const result = await snapshots.runDaily();
      console.log(`goals: ${result.goals} goals judged today (${Date.now() - started} ms)`);
    }
  } finally {
    await app.close();
  }
}
/* eslint-enable no-console */

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
