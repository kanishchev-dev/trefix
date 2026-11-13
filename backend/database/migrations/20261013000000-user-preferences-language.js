'use strict';

/** Language of texts generated outside a request (coach messages, emails); null until the client reports it. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_preferences', 'language', {
      type: Sequelize.STRING(8),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('user_preferences', 'language');
  },
};
