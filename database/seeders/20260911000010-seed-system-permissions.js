'use strict';

const { randomUUID } = require('crypto');

const { SYSTEM_PERMISSION_CATALOG } = require('../../src/modules/permissions/constants/system-access.constants.ts');
const { upsertByUniqueColumn } = require('./helpers');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const permission of SYSTEM_PERMISSION_CATALOG) {
        await upsertByUniqueColumn(
          queryInterface,
          'permissions',
          'name',
          {
            id: randomUUID(),
            name: permission.key,
            description: permission.description,
          },
          transaction,
        );
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DELETE FROM permissions WHERE name IN (:permissionNames)', {
      replacements: {
        permissionNames: SYSTEM_PERMISSION_CATALOG.map((permission) => permission.key),
      },
    });
  },
};
