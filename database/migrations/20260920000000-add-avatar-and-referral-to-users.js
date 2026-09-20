'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('users', 'avatar_url', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('users', 'referral_code', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addIndex('users', ['referral_code'], {
      unique: true,
      name: 'users_referral_code_unique',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('users', 'users_referral_code_unique');
    await queryInterface.removeColumn('users', 'referral_code');
    await queryInterface.removeColumn('users', 'avatar_url');
  },
};
