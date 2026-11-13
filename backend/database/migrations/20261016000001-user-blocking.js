'use strict';

/** Administrative blocking of accounts: a blocked user cannot sign in and loses every session. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run(`
        ALTER TABLE users
          ADD COLUMN blocked_at TIMESTAMPTZ NULL,
          ADD COLUMN blocked_until TIMESTAMPTZ NULL,
          ADD COLUMN blocked_reason VARCHAR(32) NULL,
          ADD COLUMN blocked_comment VARCHAR(500) NULL,
          ADD COLUMN blocked_by UUID NULL REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
      `);
      await run(`CREATE INDEX users_blocked_at_idx ON users (blocked_at) WHERE blocked_at IS NOT NULL;`);
    });
  },

  async down(queryInterface) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
      await run('DROP INDEX IF EXISTS users_blocked_at_idx;');
      await run(`
        ALTER TABLE users
          DROP COLUMN blocked_by,
          DROP COLUMN blocked_comment,
          DROP COLUMN blocked_reason,
          DROP COLUMN blocked_until,
          DROP COLUMN blocked_at;
      `);
    });
  },
};
