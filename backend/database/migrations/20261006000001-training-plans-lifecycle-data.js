'use strict';

const UNIQUE_ACTIVE_INDEX = 'training_plans_one_active_per_athlete';
const BATCH_SIZE = 500;
const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const RACE_DISTANCE_KM = {
  '5k': 5,
  '10k': 10,
  half_marathon: 21.0975,
  marathon: 42.195,
  just_running: 0,
};

/**
 * Formats a goal summary title the same way the application service does
 * (TrainingService.resolveGoalSummaryTitle) so migrated plan names match what
 * the UI computed before the migration.
 */
function resolveGoalSummaryTitle(goal) {
  if (!goal) {
    return 'Training Plan';
  }

  if (goal.type === 'custom' && goal.payload && goal.payload.description) {
    return String(goal.payload.description);
  }

  const target = (goal.payload && goal.payload.target) || {};
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = Math.abs(Math.round(secs % 60));
    return `${mins}:${String(s).padStart(2, '0')}`;
  };

  const distanceMeters = typeof target.distanceMeters === 'number' ? target.distanceMeters : null;
  const finishTimeSec = typeof target.finishTimeSec === 'number' ? target.finishTimeSec : null;
  if (distanceMeters) {
    const distanceKm = Math.round(distanceMeters / 100) / 10;
    return finishTimeSec ? `${distanceKm} km · ${formatTime(finishTimeSec)}` : `${distanceKm} km goal`;
  }

  if (typeof target.runsPerWeek === 'number') {
    return `${target.runsPerWeek} runs/week`;
  }
  if (typeof target.weightKg === 'number') {
    return `${target.weightKg} kg goal`;
  }

  return goal.type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function buildGoalConfigSnapshot(goal) {
  if (!goal) {
    return null;
  }

  return {
    type: goal.type,
    current: (goal.payload && goal.payload.current) || null,
    target: (goal.payload && goal.payload.target) || null,
    description: (goal.payload && goal.payload.description) || null,
    targetDate: goal.target_date || null,
    priority: goal.priority,
  };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const transaction = await sequelize.transaction();
    try {
      // ---- Pass 1: backfill name / config / metrics snapshot, batch by 500.
      let lastId = null;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const rows = await sequelize.query(
          `SELECT p.id, p.athlete_id, p.goal_id, p.start_date, p.end_date, p.status,
                  p.weeks, p.manual_config, p.training_frequency,
                  a.available_training_days, a.preferred_workout_duration_minutes,
                  a.sessions_per_week, a.weekly_mileage_km,
                  g.type AS g_type, g.payload AS g_payload, g.target_date AS g_target_date,
                  g.priority AS g_priority, g.race_distance AS g_race_distance,
                  g.target_time_seconds AS g_target_time
             FROM training_plans p
             LEFT JOIN athletes a ON a.id = p.athlete_id
             LEFT JOIN athlete_goals g ON g.id = p.goal_id
            WHERE p.deleted_at IS NULL ${lastId ? 'AND p.id > :lastId' : ''}
            ORDER BY p.id
            LIMIT :batch`,
          {
            replacements: { batch: BATCH_SIZE, lastId },
            transaction,
            type: sequelize.QueryTypes.SELECT,
          },
        );
        if (rows.length === 0) {
          break;
        }

        for (const row of rows) {
          const goal = {
            type: row.g_type || 'prepare_for_race',
            payload: row.g_payload || null,
            target_date: row.g_target_date,
            priority: row.g_priority,
          };
          const name = resolveGoalSummaryTitle(goal);

          const manualConfig = row.manual_config || {};
          const schedule = manualConfig.schedule || {
            // Athlete availability is stored as weekday names; the plan config uses indexes (0 = Monday).
            trainingDays: (Array.isArray(row.available_training_days) ? row.available_training_days : [])
              .map((day) => WEEKDAYS.indexOf(String(day).toLowerCase()))
              .filter((index) => index >= 0)
              .sort((left, right) => left - right),
            preferredLongRunDay: null,
            workoutDurationMinutes: row.preferred_workout_duration_minutes || null,
          };
          const structure = manualConfig.structure || {
            totalWeeks: Array.isArray(row.weeks) ? row.weeks.length : 0,
            sessionsPerWeek: row.training_frequency || row.sessions_per_week || null,
          };
          const config = {
            goal: buildGoalConfigSnapshot(goal) || {
              type: 'prepare_for_race',
              current: null,
              target: row.g_race_distance
                ? {
                    distanceMeters: Math.round((RACE_DISTANCE_KM[row.g_race_distance] || 0) * 1000),
                    finishTimeSec: row.g_target_time || null,
                  }
                : null,
              description: null,
              targetDate: row.g_target_date || null,
              priority: 5,
            },
            schedule,
            structure,
          };

          // Metrics snapshot: latest athlete state created no later than the
          // plan start; missing history stays NULL.
          let metricsSnapshot = null;
          if (row.start_date) {
            const [state] = await sequelize.query(
              `SELECT threshold_pace_seconds_per_km, threshold_heart_rate
                 FROM athlete_states
                WHERE athlete_id = :athleteId AND created_at <= :startDate
                ORDER BY created_at DESC
                LIMIT 1`,
              {
                replacements: { athleteId: row.athlete_id, startDate: row.start_date },
                transaction,
                type: sequelize.QueryTypes.SELECT,
              },
            );
            if (state) {
              metricsSnapshot = {
                capturedAt: row.start_date,
                thresholdPaceSecondsPerKm: state.threshold_pace_seconds_per_km ?? null,
                thresholdHeartRate: state.threshold_heart_rate ?? null,
                weeklyMileageKm: row.weekly_mileage_km ?? null,
                source: 'athlete_state',
              };
            }
          }

          await sequelize.query(
            `UPDATE training_plans
                SET name = :name,
                    config = :config::jsonb,
                    metrics_snapshot = :metrics::jsonb
              WHERE id = :id`,
            {
              replacements: {
                id: row.id,
                name: name.slice(0, 80),
                config: JSON.stringify(config),
                metrics: metricsSnapshot ? JSON.stringify(metricsSnapshot) : null,
              },
              transaction,
            },
          );
        }

        lastId = rows[rows.length - 1].id;
      }

      // ---- Pass 2: auto-complete stale active plans together with their goals.
      await sequelize.query(
        `UPDATE athlete_goals g
            SET status = 'completed', updated_at = NOW()
          WHERE g.status = 'active'
            AND EXISTS (
              SELECT 1 FROM training_plans p
               WHERE p.goal_id = g.id AND p.status = 'active' AND p.deleted_at IS NULL AND p.end_date < :today
            )`,
        { replacements: { today: todayIso() }, transaction },
      );
      await sequelize.query(
        `UPDATE training_plans
            SET status = 'completed', updated_at = NOW()
          WHERE status = 'active' AND deleted_at IS NULL AND end_date < :today`,
        { replacements: { today: todayIso() }, transaction },
      );

      // ---- Pass 3: keep at most one active plan per athlete.
      const duplicates = await sequelize.query(
        `SELECT athlete_id, array_agg(id ORDER BY created_at DESC) AS plan_ids
           FROM training_plans
          WHERE status = 'active' AND deleted_at IS NULL
          GROUP BY athlete_id
         HAVING COUNT(*) > 1`,
        { transaction, type: sequelize.QueryTypes.SELECT },
      );

      for (const row of duplicates) {
        const planIds = row.plan_ids || [];
        // The newest active plan wins; the rest become cancelled history.
        const losers = planIds.slice(1);
        if (losers.length === 0) {
          continue;
        }

        await sequelize.query(
          `UPDATE training_plans
              SET status = 'cancelled',
                  cancelled_at = NOW(),
                  cancel_reason = 'migration',
                  replaced_by_plan_id = :winnerId,
                  updated_at = NOW()
            WHERE id IN (:losers)`,
          {
            replacements: { winnerId: planIds[0], losers },
            transaction,
          },
        );

        await sequelize.query(
          `UPDATE workouts
              SET status = 'cancelled', updated_at = NOW()
            WHERE plan_id IN (:losers) AND status = 'planned'
              AND scheduled_at >= date_trunc('day', NOW())`,
          { replacements: { losers }, transaction },
        );

        await sequelize.query(
          `UPDATE athlete_goals g
              SET status = 'cancelled', updated_at = NOW()
            WHERE g.status = 'active'
              AND EXISTS (SELECT 1 FROM training_plans p WHERE p.id IN (:losers) AND p.goal_id = g.id)`,
          { replacements: { losers }, transaction },
        );
      }

      // ---- Pass 4: the single-active invariant can only be enforced once the
      // historical duplicates are gone.
      await sequelize.query(
        `CREATE UNIQUE INDEX IF NOT EXISTS ${UNIQUE_ACTIVE_INDEX}
           ON training_plans (athlete_id)
         WHERE status = 'active' AND deleted_at IS NULL;`,
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    // Dropped with the schema migration; plans cancelled by the migration are
    // not re-activated on purpose — the outcome is documented in the PR.
    await queryInterface.sequelize.query(
      `DROP INDEX IF EXISTS ${UNIQUE_ACTIVE_INDEX};`,
    );
  },
};
