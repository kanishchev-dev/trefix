'use strict';

const { randomUUID } = require('crypto');

const { SYSTEM_ADMIN_USER } = require('../../src/modules/permissions/constants/system-access.constants.ts');
const { upsertByUniqueColumn } = require('./helpers');

const AUTH_PASSWORD_HASH_ROUNDS = 12;

module.exports = {
  up: async (queryInterface) => {
    const bcrypt = require('bcryptjs');
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword) {
      throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set to seed the system administrator');
    }

    const passwordHash = await bcrypt.hash(adminPassword, AUTH_PASSWORD_HASH_ROUNDS);

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
