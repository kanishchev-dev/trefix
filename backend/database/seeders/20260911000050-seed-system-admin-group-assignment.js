'use strict';

const {
  SYSTEM_ADMIN_USER,
  SYSTEM_PERMISSION_GROUPS,
} = require('../../src/modules/permissions/constants/system-access.constants.ts');
const { insertJoinRows } = require('./helpers');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const userRows = await queryInterface.sequelize.query('SELECT id FROM users WHERE system_key = :systemKey', {
        replacements: { systemKey: SYSTEM_ADMIN_USER.systemKey },
        type: queryInterface.sequelize.QueryTypes.SELECT,
        transaction,
      });

      const groupRows = await queryInterface.sequelize.query(
        'SELECT id FROM permission_groups WHERE system_key = :systemKey',
        {
          replacements: { systemKey: SYSTEM_PERMISSION_GROUPS[0].systemKey },
          type: queryInterface.sequelize.QueryTypes.SELECT,
          transaction,
        },
      );

      const userId = userRows[0]?.id;
      const groupId = groupRows[0]?.id;

      if (!userId) {
        throw new Error(`System admin user not found: ${SYSTEM_ADMIN_USER.systemKey}`);
      }

      if (!groupId) {
        throw new Error(`System permission group not found: ${SYSTEM_PERMISSION_GROUPS[0].systemKey}`);
      }

      await insertJoinRows(
        queryInterface,
        'user_permission_groups',
        [
          {
            user_id: userId,
            permission_group_id: groupId,
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        transaction,
      );
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      await queryInterface.sequelize.query(
        `
          DELETE FROM user_permission_groups
          WHERE user_id IN (
            SELECT id FROM users WHERE system_key = :systemKey
          )
          AND permission_group_id IN (
            SELECT id FROM permission_groups WHERE system_key = :groupKey
          )
        `,
        {
          replacements: {
            systemKey: SYSTEM_ADMIN_USER.systemKey,
            groupKey: SYSTEM_PERMISSION_GROUPS[0].systemKey,
          },
          transaction,
        },
      );
    });
  },
};
