'use strict';

const GOAL_TYPE_CONSTRAINT = 'athlete_goals_type_check';

// Universal goal taxonomy (PRD section 6). Kept in sync with
// src/modules/training/goal-taxonomy.ts; migrations must not import TS code.
const GOAL_TYPES = [
  'prepare_for_race',
  'improve_race_result',
  'run_new_distance',
  'trail_preparation',
  'ultra_preparation',
  'backyard_preparation',
  'improve_speed',
  'improve_pace',
  'build_endurance',
  'improve_aerobic_fitness',
  'improve_hills',
  'start_running',
  'return_to_running',
  'build_consistency',
  'increase_running_volume',
  'run_continuously',
  'lose_weight',
  'maintain_fitness',
  'general_health',
  'complete_challenge',
  'custom',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Discriminator column for the polymorphic goal model (PRD section 9).
    await queryInterface.addColumn('athlete_goals', 'type', {
      type: Sequelize.DataTypes.STRING,
      allowNull: false,
      defaultValue: 'prepare_for_race',
    });

    // 2. Type-specific payload: { current?, target?, description? }.
    await queryInterface.addColumn('athlete_goals', 'payload', {
      type: Sequelize.DataTypes.JSONB,
      allowNull: true,
    });

    // 3. Legacy rows map onto the universal model without inventing intent:
    //    a stored target time means "improve the result", otherwise the goal
    //    stays a plain race preparation (PRD section 26).
    await queryInterface.sequelize.query(`
      UPDATE athlete_goals
      SET type = CASE
        WHEN target_time_seconds IS NOT NULL THEN 'improve_race_result'
        ELSE 'prepare_for_race'
      END,
      payload = jsonb_build_object(
        'target', jsonb_build_object(
          'distanceMeters', CASE race_distance
            WHEN '5k' THEN 5000
            WHEN '10k' THEN 10000
            WHEN 'half_marathon' THEN 21097
            WHEN 'marathon' THEN 42195
          END,
          'finishTimeSec', target_time_seconds
        )
      )
      WHERE payload IS NULL
        AND race_distance IN ('5k', '10k', 'half_marathon', 'marathon');
    `);

    // Rows without a race distance ("just_running") carry no metric payload.
    await queryInterface.sequelize.query(`
      UPDATE athlete_goals
      SET type = 'prepare_for_race',
          payload = jsonb_build_object('target', '{}'::jsonb)
      WHERE payload IS NULL;
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE athlete_goals
        DROP CONSTRAINT IF EXISTS ${GOAL_TYPE_CONSTRAINT};
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE athlete_goals
        ADD CONSTRAINT ${GOAL_TYPE_CONSTRAINT}
        CHECK (type IN ('${GOAL_TYPES.join("', '")}'));
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE athlete_goals DROP CONSTRAINT IF EXISTS ${GOAL_TYPE_CONSTRAINT};
    `);

    // Rebuild legacy race columns from the payload before dropping it.
    await queryInterface.sequelize.query(`
      UPDATE athlete_goals
      SET race_distance = CASE payload->'target'->>'distanceMeters'
        WHEN '5000' THEN '5k'
        WHEN '10000' THEN '10k'
        WHEN '21097' THEN 'half_marathon'
        WHEN '42195' THEN 'marathon'
        ELSE 'just_running'
      END,
      target_time_seconds = NULLIF(payload->'target'->>'finishTimeSec', '')::integer
      WHERE payload IS NOT NULL;
    `);

    await queryInterface.removeColumn('athlete_goals', 'payload');
    await queryInterface.removeColumn('athlete_goals', 'type');
  },
};
