'use strict';

/*
 * The backend no longer stores English text it generated itself: the apps
 * translate workout types, week phases, adaptation reasons and goal targets.
 * Removes such text from existing rows; text typed by people is kept.
 */

// Default plan names built from the goal, optionally with the rebuild year.
const GENERATED_PLAN_NAME = String.raw`^(Training Plan|\d+(\.\d+)? km goal|\d+(\.\d+)? km · \d+:\d{2}|\d+ runs/week|\d+(\.\d+)? kg goal)( \d{4})?$`;

module.exports = {
  async up(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const run = (sql, replacements) => queryInterface.sequelize.query(sql, { transaction, replacements });
    try {
      await run(`ALTER TABLE training_plans ALTER COLUMN name DROP NOT NULL;`);

      await run(
        `UPDATE training_plans
            SET name = NULL
          WHERE name ~ :pattern
             OR name ~ ('^' || initcap(replace(config->'goal'->>'type', '_', ' ')) || '( \\d{4})?$');`,
        { pattern: GENERATED_PLAN_NAME },
      );

      // "Easy Run", "Long_run Run" (self-service) and "Long run Run" (admin).
      await run(`
        UPDATE workouts
           SET target = target - 'title'
         WHERE target ? 'title'
           AND target->>'title' ~ '^[A-Z][A-Za-z_ ]* Run$'
           AND lower(replace(regexp_replace(target->>'title', ' Run$', ''), ' ', '_')) = type;
      `);
      await run(`
        UPDATE workouts
           SET target = target - 'description'
         WHERE target->>'description' ~ '^\\d+(\\.\\d+)? km at target pace$';
      `);

      // Week titles and intents, workout titles inside relative (draft) weeks.
      await run(`
        UPDATE training_plans
           SET weeks = (
             SELECT COALESCE(
               jsonb_agg(
                 CASE
                   WHEN jsonb_typeof(week->'workouts') = 'array' THEN
                     (week - 'title' - 'intent') || jsonb_build_object(
                       'workouts',
                       (SELECT COALESCE(jsonb_agg(workout - 'title' ORDER BY position), '[]'::jsonb)
                          FROM jsonb_array_elements(week->'workouts') WITH ORDINALITY AS w(workout, position))
                     )
                   ELSE week - 'title' - 'intent'
                 END
                 ORDER BY ordinal
               ),
               '[]'::jsonb
             )
             FROM jsonb_array_elements(weeks) WITH ORDINALITY AS t(week, ordinal)
           )
         WHERE jsonb_typeof(weeks) = 'array'
           AND jsonb_array_length(weeks) > 0;
      `);

      await run(`
        UPDATE adaptation_events
           SET reason = 'heart_rate_zones_changed'
         WHERE reason = 'Heart rate zones changed';
      `);
      await run(`
        UPDATE adaptation_events
           SET decision = jsonb_set(
             decision,
             '{changes}',
             (SELECT jsonb_agg(
                CASE WHEN change ? 'note' THEN (change - 'note') || '{"noChanges": true}'::jsonb ELSE change END
                ORDER BY position)
                FROM jsonb_array_elements(decision->'changes') WITH ORDINALITY AS c(change, position))
           )
         WHERE jsonb_typeof(decision->'changes') = 'array'
           AND decision->'changes' @> '[{"note": "No plan changes were necessary."}]'::jsonb;
      `);

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  // Removed texts are not restored: the apps no longer read them.
  async down(queryInterface) {
    const transaction = await queryInterface.sequelize.transaction();
    const run = (sql) => queryInterface.sequelize.query(sql, { transaction });
    try {
      await run(
        `UPDATE adaptation_events SET reason = 'Heart rate zones changed' WHERE reason = 'heart_rate_zones_changed';`,
      );
      await run(`UPDATE training_plans SET name = 'Training Plan' WHERE name IS NULL;`);
      await run(`ALTER TABLE training_plans ALTER COLUMN name SET NOT NULL;`);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
