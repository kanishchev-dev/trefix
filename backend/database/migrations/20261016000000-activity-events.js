'use strict';

/**
 * Activity history of users: what the user, administrators, integrations, the
 * system and the AI coach did with the user's data. Append-only.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run(`
        CREATE TABLE activity_events (
          id UUID PRIMARY KEY,
          occurred_at TIMESTAMPTZ NOT NULL,
          subject_user_id UUID NULL,
          actor_type VARCHAR(16) NOT NULL,
          actor_user_id UUID NULL,
          action VARCHAR(64) NOT NULL,
          domain VARCHAR(24) NOT NULL,
          entity_type VARCHAR(32) NULL,
          entity_id VARCHAR(64) NULL,
          changes JSONB NULL,
          metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
          source VARCHAR(16) NOT NULL,
          client JSONB NULL,
          ip INET NULL,
          trace_id VARCHAR(128) NULL,
          CONSTRAINT activity_events_actor_type_chk
            CHECK (actor_type IN ('user', 'admin', 'system', 'integration', 'coach')),
          CONSTRAINT activity_events_source_chk
            CHECK (source IN ('mobile', 'web', 'admin', 'webhook', 'job'))
        );
      `);
      // No foreign keys on purpose: the history must outlive deleted users and entities.
      await run(`
        CREATE INDEX activity_events_subject_idx
          ON activity_events (subject_user_id, occurred_at DESC, id DESC);
      `);
      await run(`
        CREATE INDEX activity_events_admin_actor_idx
          ON activity_events (actor_user_id, occurred_at DESC, id DESC)
          WHERE actor_type = 'admin';
      `);
      await run(`CREATE INDEX activity_events_domain_idx ON activity_events (domain, occurred_at DESC, id DESC);`);
      await run(`CREATE INDEX activity_events_occurred_idx ON activity_events (occurred_at DESC, id DESC);`);
      await run(`CREATE INDEX activity_events_entity_idx ON activity_events (entity_type, entity_id);`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP TABLE activity_events;');
  },
};
