'use strict';

const PLAN_CANCEL_REASON_CHECK = 'training_plans_cancel_reason_check';

/** Allows `admin` as a cancel reason: plans cancelled from the admin panel. */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TABLE training_plans
         DROP CONSTRAINT ${PLAN_CANCEL_REASON_CHECK},
         ADD CONSTRAINT ${PLAN_CANCEL_REASON_CHECK}
           CHECK (cancel_reason IS NULL OR cancel_reason IN ('replaced', 'user', 'admin', 'migration'));`,
    );
  },

  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // Rows written by the admin panel would violate the old constraint; they read as user cancellations.
      await queryInterface.sequelize.query(
        `UPDATE training_plans SET cancel_reason = 'user' WHERE cancel_reason = 'admin';`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `ALTER TABLE training_plans
           DROP CONSTRAINT ${PLAN_CANCEL_REASON_CHECK},
           ADD CONSTRAINT ${PLAN_CANCEL_REASON_CHECK}
             CHECK (cancel_reason IS NULL OR cancel_reason IN ('replaced', 'user', 'migration'));`,
        { transaction },
      );
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
