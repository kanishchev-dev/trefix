'use strict';
/**
 * Indexes for the analytics queries. Built CONCURRENTLY so large tables stay
 * writable, which is why this migration runs outside a transaction.
 */
const INDEXES = [
  ['workouts_status_completed_at_idx', 'workouts (status, completed_at) WHERE deleted_at IS NULL'],
  ['workouts_plan_scheduled_at_idx', 'workouts (plan_id, scheduled_at) WHERE deleted_at IS NULL'],
  ['training_plans_status_created_at_idx', 'training_plans (status, created_at) WHERE deleted_at IS NULL'],
  ['athlete_states_athlete_created_at_idx', 'athlete_states (athlete_id, created_at)'],
  ['coach_messages_user_created_at_idx', "coach_messages (created_at) WHERE role = 'user' AND deleted_at IS NULL"],
  ['users_created_at_idx', 'users (created_at)'],
  ['notification_deliveries_status_created_at_idx', 'notification_deliveries (status, created_at)'],
];

module.exports = {
  async up(queryInterface) {
    for (const [name, definition] of INDEXES) {
      await queryInterface.sequelize.query(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ON ${definition};`);
    }
  },

  async down(queryInterface) {
    for (const [name] of [...INDEXES].reverse()) {
      await queryInterface.sequelize.query(`DROP INDEX CONCURRENTLY IF EXISTS ${name};`);
    }
  },
};
