'use strict';

const {
  SYSTEM_PERMISSION_CATALOG,
  SYSTEM_PERMISSION_GROUPS,
} = require('../../src/modules/permissions/constants/system-access.constants.ts');
const { syncJoinTable } = require('./helpers');

module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const permissionRows = await queryInterface.sequelize.query(
        'SELECT id, name FROM permissions WHERE name = ANY(:permissionNames)',
        {
          replacements: {
            permissionNames: SYSTEM_PERMISSION_CATALOG.map((permission) => permission.key),
          },
          type: queryInterface.sequelize.QueryTypes.SELECT,
          transaction,
        },
      );

      const permissionIdsByName = new Map(permissionRows.map((row) => [row.name, row.id]));

      for (const group of SYSTEM_PERMISSION_GROUPS) {
        const groupRows = await queryInterface.sequelize.query(
          'SELECT id FROM permission_groups WHERE system_key = :systemKey',
          {
            replacements: { systemKey: group.systemKey },
            type: queryInterface.sequelize.QueryTypes.SELECT,
            transaction,
          },
        );

        const groupId = groupRows[0]?.id;
        if (!groupId) {
          throw new Error(`System permission group not found: ${group.systemKey}`);
        }

        const permissionIds = group.permissionKeys
          .map((permissionKey) => permissionIdsByName.get(permissionKey))
          .filter((permissionId) => typeof permissionId === 'string');

        if (permissionIds.length !== group.permissionKeys.length) {
          throw new Error(`One or more seeded permissions are missing for group ${group.systemKey}`);
        }

        await syncJoinTable(
          queryInterface,
          'permission_group_permissions',
          'permission_group_id',
          groupId,
          'permission_id',
          permissionIds,
          transaction,
        );
      }
    });
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const seededGroupKeys = SYSTEM_PERMISSION_GROUPS.map((group) => group.systemKey);
      const seededPermissionKeys = SYSTEM_PERMISSION_CATALOG.map((permission) => permission.key);

      await queryInterface.sequelize.query(
        `
          DELETE FROM permission_group_permissions
          WHERE permission_group_id IN (
            SELECT id FROM permission_groups WHERE system_key IN (:groupKeys)
          )
          AND permission_id IN (
            SELECT id FROM permissions WHERE name IN (:permissionKeys)
          )
        `,
        {
          replacements: {
            groupKeys: seededGroupKeys,
            permissionKeys: seededPermissionKeys,
          },
          transaction,
        },
      );
    });
  },
};
