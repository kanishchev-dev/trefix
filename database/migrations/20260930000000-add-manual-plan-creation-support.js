'use strict';

const MANUAL_PLAN_CONSTRAINT = 'training_plans_manual_config_check';
const GOAL_DISTANCE_CONSTRAINT = 'athlete_goals_race_distance_check';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Track how each plan was created (analytics/debugging, per PRD section 18).
    await queryInterface.addColumn('training_plans', 'creation_source', {
      type: Sequelize.DataTypes.STRING,
      allowNull: false,
      defaultValue: 'ai',
    });

    // 2. Manual plans may exist without a hard race date ("Just running"),
    //    so the goal target date becomes optional for the manual flow.
    await queryInterface.changeColumn('athlete_goals', 'target_date', {
      type: Sequelize.DataTypes.DATEONLY,
      allowNull: true,
    });

    // 3. Store the client-supplied manual configuration on the plan for audit/debugging.
    await queryInterface.addColumn('training_plans', 'manual_config', {
      type: Sequelize.DataTypes.JSONB,
      allowNull: true,
    });

    // 4. Widen the race distance check to accept the new 'just_running' goal.
    await queryInterface.sequelize.query(`
      ALTER TABLE athlete_goals DROP CONSTRAINT IF EXISTS ${GOAL_DISTANCE_CONSTRAINT};
    `);
    const allowedDistances = ['5k', '10k', 'half_marathon', 'marathon', 'just_running'];
    await queryInterface.sequelize.query(`
      ALTER TABLE athlete_goals
        ADD CONSTRAINT ${GOAL_DISTANCE_CONSTRAINT}
        CHECK (race_distance IN ('${allowedDistances.join("', '")}'));
    `);

    // 5. Ensure manual config JSON matches the supported creation sources shape.
    await queryInterface.sequelize.query(`
      ALTER TABLE training_plans DROP CONSTRAINT IF EXISTS ${MANUAL_PLAN_CONSTRAINT};
    `);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      ALTER TABLE training_plans DROP CONSTRAINT IF EXISTS ${MANUAL_PLAN_CONSTRAINT};
    `);

    // Restore the strict distance check without 'just_running'.
    await queryInterface.sequelize.query(`
      ALTER TABLE athlete_goals DROP CONSTRAINT IF EXISTS ${GOAL_DISTANCE_CONSTRAINT};
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE athlete_goals
        ADD CONSTRAINT ${GOAL_DISTANCE_CONSTRAINT}
        CHECK (race_distance IN ('5k', '10k', 'half_marathon', 'marathon'));
    `);

    await queryInterface.removeColumn('training_plans', 'manual_config');
    await queryInterface.changeColumn('athlete_goals', 'target_date', {
      type: Sequelize.DataTypes.DATEONLY,
      allowNull: false,
    });
    await queryInterface.removeColumn('training_plans', 'creation_source');
  },
};
