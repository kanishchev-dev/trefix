'use strict';

const { randomUUID } = require('crypto');

const { hashPassword } = require('../../src/common/utils/password-hash.util.ts');
const { SYSTEM_ADMIN_USER } = require('../../src/modules/permissions/constants/system-access.constants.ts');
const { upsertByUniqueColumn } = require('./helpers');

module.exports = {
  up: async (queryInterface) => {
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the system administrator');
    }

    const passwordHash = await hashPassword(adminPassword, 12);

    await queryInterface.sequelize.transaction(async (transaction) => {
      await upsertByUniqueColumn(
        queryInterface,
        'users',
        'system_key',
        {
          id: randomUUID(),
          email: adminEmail.trim().toLowerCase(),
          first_name: SYSTEM_ADMIN_USER.firstName,
          last_name: SYSTEM_ADMIN_USER.lastName,
          password_hash: passwordHash,
          system_key: SYSTEM_ADMIN_USER.systemKey,
          is_system: true,
          email_verified: true,
          email_verified_at: new Date(),
          password_changed_at: new Date(),
        },
        transaction,
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DELETE FROM users WHERE system_key = :systemKey', {
      replacements: { systemKey: SYSTEM_ADMIN_USER.systemKey },
    });
  },
};
