'use strict';

const { randomUUID } = require('crypto');

const { SYSTEM_PERMISSION_GROUPS } = require('../../src/modules/permissions/constants/system-access.constants.ts');
const { upsertByUniqueColumn } = require('./helpers');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      for (const group of SYSTEM_PERMISSION_GROUPS) {
        await upsertByUniqueColumn(
          queryInterface,
          'permission_groups',
          'system_key',
          {
            id: randomUUID(),
            name: group.name,
            description: group.description,
            system_key: group.systemKey,
            is_system: true,
          },
          transaction,
        );
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DELETE FROM permission_groups WHERE system_key IN (:systemKeys)', {
      replacements: {
        systemKeys: SYSTEM_PERMISSION_GROUPS.map((group) => group.systemKey),
      },
    });
  },
};
