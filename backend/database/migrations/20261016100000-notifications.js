'use strict';

/**
 * User notifications: the in-app inbox, delivery of each notification over push
 * and email, the devices that receive pushes, and admin broadcasts.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run(`
        CREATE TABLE notification_broadcasts (
          id UUID PRIMARY KEY,
          created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
          audience JSONB NOT NULL,
          content JSONB NOT NULL,
          link JSONB NULL,
          channels VARCHAR(8)[] NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'queued',
          recipients_count INTEGER NOT NULL DEFAULT 0,
          error VARCHAR(500) NULL,
          completed_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT notification_broadcasts_status_chk CHECK (status IN ('queued', 'sending', 'sent', 'failed'))
        );
      `);
      await run(`CREATE INDEX notification_broadcasts_created_idx ON notification_broadcasts (created_at DESC, id DESC);`);

      await run(`
        CREATE TABLE notifications (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          broadcast_id UUID NULL REFERENCES notification_broadcasts(id) ON DELETE SET NULL ON UPDATE CASCADE,
          category VARCHAR(16) NOT NULL,
          type VARCHAR(48) NOT NULL,
          content JSONB NOT NULL DEFAULT '{}'::jsonb,
          params JSONB NOT NULL DEFAULT '{}'::jsonb,
          link JSONB NULL,
          read_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT notifications_category_chk
            CHECK (category IN ('coach', 'admin', 'workouts', 'plans', 'progress', 'account'))
        );
      `);
      await run(`CREATE INDEX notifications_user_idx ON notifications (user_id, created_at DESC, id DESC);`);
      await run(`CREATE INDEX notifications_unread_idx ON notifications (user_id) WHERE read_at IS NULL;`);
      await run(`CREATE INDEX notifications_broadcast_idx ON notifications (broadcast_id) WHERE broadcast_id IS NOT NULL;`);
      await run(`CREATE INDEX notifications_created_idx ON notifications (created_at);`);

      await run(`
        CREATE TABLE notification_deliveries (
          id UUID PRIMARY KEY,
          notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE ON UPDATE CASCADE,
          channel VARCHAR(8) NOT NULL,
          status VARCHAR(12) NOT NULL DEFAULT 'pending',
          error VARCHAR(64) NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          tickets JSONB NULL,
          sent_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT notification_deliveries_channel_chk CHECK (channel IN ('push', 'email')),
          CONSTRAINT notification_deliveries_status_chk
            CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'skipped')),
          CONSTRAINT notification_deliveries_unique UNIQUE (notification_id, channel)
        );
      `);

      await run(`
        CREATE TABLE push_devices (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          session_id VARCHAR(64) NULL,
          token VARCHAR(255) NOT NULL,
          platform VARCHAR(8) NOT NULL,
          locale VARCHAR(8) NULL,
          app_version VARCHAR(32) NULL,
          device_name VARCHAR(100) NULL,
          last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          CONSTRAINT push_devices_platform_chk CHECK (platform IN ('ios', 'android')),
          CONSTRAINT push_devices_token_unique UNIQUE (token)
        );
      `);
      await run(`CREATE INDEX push_devices_user_idx ON push_devices (user_id);`);
      await run(`CREATE INDEX push_devices_session_idx ON push_devices (session_id) WHERE session_id IS NOT NULL;`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run('DROP TABLE IF EXISTS push_devices;');
      await run('DROP TABLE IF EXISTS notification_deliveries;');
      await run('DROP TABLE IF EXISTS notifications;');
      await run('DROP TABLE IF EXISTS notification_broadcasts;');
    });
  },
};
