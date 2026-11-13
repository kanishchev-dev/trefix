'use strict';
/**
 * Analytics storage: daily activity of users, LLM usage, the personal records
 * log, daily snapshots of goal progress and precomputed daily metrics.
 */
module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
    try {
      await run(`
        CREATE TABLE user_daily_activity (
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          date DATE NOT NULL,
          platforms VARCHAR(16)[] NOT NULL DEFAULT '{}',
          app_version VARCHAR(32) NULL,
          first_seen_at TIMESTAMPTZ NOT NULL,
          last_seen_at TIMESTAMPTZ NOT NULL,
          PRIMARY KEY (user_id, date)
        );
      `);
      await run(`CREATE INDEX user_daily_activity_date_idx ON user_daily_activity (date);`);

      await run(`
        CREATE TABLE llm_usage (
          id UUID PRIMARY KEY,
          user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
          feature VARCHAR(32) NOT NULL,
          model VARCHAR(64) NOT NULL,
          input_tokens INTEGER NOT NULL DEFAULT 0,
          cached_input_tokens INTEGER NOT NULL DEFAULT 0,
          output_tokens INTEGER NOT NULL DEFAULT 0,
          cost_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
          latency_ms INTEGER NULL,
          status VARCHAR(16) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await run(`CREATE INDEX llm_usage_created_idx ON llm_usage (created_at);`);
      await run(`CREATE INDEX llm_usage_user_idx ON llm_usage (user_id, created_at);`);

      await run(`
        CREATE TABLE athlete_records_log (
          id UUID PRIMARY KEY,
          athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE ON UPDATE CASCADE,
          workout_id UUID NULL REFERENCES workouts(id) ON DELETE SET NULL ON UPDATE CASCADE,
          race_result_id UUID NULL REFERENCES race_results(id) ON DELETE SET NULL ON UPDATE CASCADE,
          distance VARCHAR(16) NOT NULL,
          time_seconds INTEGER NOT NULL,
          previous_seconds INTEGER NULL,
          achieved_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          CONSTRAINT athlete_records_log_unique UNIQUE (athlete_id, distance, achieved_at)
        );
      `);
      await run(`CREATE INDEX athlete_records_log_achieved_idx ON athlete_records_log (achieved_at);`);

      await run(`
        CREATE TABLE goal_progress_snapshots (
          goal_id UUID NOT NULL REFERENCES athlete_goals(id) ON DELETE CASCADE ON UPDATE CASCADE,
          date DATE NOT NULL,
          athlete_id UUID NOT NULL REFERENCES athletes(id) ON DELETE CASCADE ON UPDATE CASCADE,
          category VARCHAR(24) NOT NULL,
          goal_type VARCHAR(32) NOT NULL,
          status VARCHAR(16) NOT NULL,
          progress_pct NUMERIC(5, 1) NULL,
          current_value NUMERIC NULL,
          target_value NUMERIC NULL,
          target_date DATE NULL,
          PRIMARY KEY (goal_id, date)
        );
      `);
      await run(`CREATE INDEX goal_progress_snapshots_date_idx ON goal_progress_snapshots (date, status);`);
      await run(`CREATE INDEX goal_progress_snapshots_athlete_idx ON goal_progress_snapshots (athlete_id, date);`);

      await run(`
        CREATE TABLE analytics_daily_metrics (
          date DATE NOT NULL,
          metric VARCHAR(48) NOT NULL,
          dimension VARCHAR(48) NOT NULL DEFAULT '',
          value NUMERIC NOT NULL,
          computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (date, metric, dimension)
        );
      `);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
    try {
      await run(`DROP TABLE analytics_daily_metrics;`);
      await run(`DROP TABLE goal_progress_snapshots;`);
      await run(`DROP TABLE athlete_records_log;`);
      await run(`DROP TABLE llm_usage;`);
      await run(`DROP TABLE user_daily_activity;`);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
