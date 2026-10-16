'use strict';

/**
 * Social sign-in identities bound to a user (until now accounts were matched by email only)
 * and requests for a personal data export.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run(`
        CREATE TABLE user_identities (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          provider VARCHAR(16) NOT NULL,
          subject VARCHAR(255) NOT NULL,
          email VARCHAR(255) NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await run(`CREATE UNIQUE INDEX user_identities_provider_subject_uq ON user_identities (provider, subject);`);
      await run(`CREATE UNIQUE INDEX user_identities_user_provider_uq ON user_identities (user_id, provider);`);

      await run(`
        CREATE TABLE data_exports (
          id UUID PRIMARY KEY,
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE,
          status VARCHAR(16) NOT NULL DEFAULT 'pending',
          file_id UUID NULL,
          download_token_hash VARCHAR(64) NULL,
          error VARCHAR(255) NULL,
          ready_at TIMESTAMPTZ NULL,
          expires_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await run(`CREATE INDEX data_exports_user_id_created_at_idx ON data_exports (user_id, created_at DESC);`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query('DROP TABLE data_exports;', { transaction });
      await queryInterface.sequelize.query('DROP TABLE user_identities;', { transaction });
    });
  },
};
