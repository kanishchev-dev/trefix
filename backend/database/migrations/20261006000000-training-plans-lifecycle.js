'use strict';

const PLAN_DATES_CHECK = 'training_plans_dates_check';
const PLAN_CANCEL_REASON_CHECK = 'training_plans_cancel_reason_check';

module.exports = {
  async up(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      // 1. Drafts are stored without dates; the CHECK below still requires
      //    dates for every other status.
      await queryInterface.changeColumn(
        'training_plans',
        'start_date',
        { type: Sequelize.DataTypes.DATEONLY, allowNull: true },
        { transaction },
      );
      await queryInterface.changeColumn(
        'training_plans',
        'end_date',
        { type: Sequelize.DataTypes.DATEONLY, allowNull: true },
        { transaction },
      );

      // 2. Lifecycle columns.
      await queryInterface.addColumn(
        'training_plans',
        'name',
        {
          type: Sequelize.DataTypes.STRING(80),
          allowNull: false,
          defaultValue: 'Training Plan',
        },
        { transaction },
      );
      await queryInterface.addColumn(
        'training_plans',
        'notes',
        { type: Sequelize.DataTypes.TEXT, allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'training_plans',
        'config',
        {
          type: Sequelize.DataTypes.JSONB,
          allowNull: false,
          defaultValue: {},
        },
        { transaction },
      );
      await queryInterface.addColumn(
        'training_plans',
        'metrics_snapshot',
        { type: Sequelize.DataTypes.JSONB, allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'training_plans',
        'source_plan_id',
        {
          type: Sequelize.DataTypes.UUID,
          allowNull: true,
          references: { model: 'training_plans', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        { transaction },
      );
      await queryInterface.addColumn(
        'training_plans',
        'cancelled_at',
        { type: Sequelize.DataTypes.DATE, allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'training_plans',
        'cancel_reason',
        { type: Sequelize.DataTypes.STRING, allowNull: true },
        { transaction },
      );
      await queryInterface.addColumn(
        'training_plans',
        'replaced_by_plan_id',
        {
          type: Sequelize.DataTypes.UUID,
          allowNull: true,
          references: { model: 'training_plans', key: 'id' },
          onDelete: 'SET NULL',
          onUpdate: 'CASCADE',
        },
        { transaction },
      );
      await queryInterface.addColumn(
        'training_plans',
        'version',
        {
          type: Sequelize.DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0,
        },
        { transaction },
      );

      // 3. Query-support indexes.
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS training_plans_athlete_status_updated
           ON training_plans (athlete_id, status, updated_at DESC)
         WHERE deleted_at IS NULL;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS workouts_athlete_status_scheduled
           ON workouts (athlete_id, status, scheduled_at);`,
        { transaction },
      );

      // 4. Domain constraints.
      await queryInterface.sequelize.query(
        `ALTER TABLE training_plans
           DROP CONSTRAINT IF EXISTS ${PLAN_DATES_CHECK},
           DROP CONSTRAINT IF EXISTS ${PLAN_CANCEL_REASON_CHECK},
           ADD CONSTRAINT ${PLAN_DATES_CHECK}
             CHECK (status = 'draft' OR (start_date IS NOT NULL AND end_date IS NOT NULL)),
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

  async down(queryInterface, Sequelize) {
    const transaction = await queryInterface.sequelize.transaction();
    try {
      await queryInterface.sequelize.query(
        `ALTER TABLE training_plans
           DROP CONSTRAINT IF EXISTS ${PLAN_DATES_CHECK},
           DROP CONSTRAINT IF EXISTS ${PLAN_CANCEL_REASON_CHECK};`,
        { transaction },
      );

      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS workouts_athlete_status_scheduled;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS training_plans_athlete_status_updated;`,
        { transaction },
      );
      await queryInterface.sequelize.query(
        `DROP INDEX IF EXISTS training_plans_one_active_per_athlete;`,
        { transaction },
      );

      await queryInterface.removeColumn('training_plans', 'version', { transaction });
      await queryInterface.removeColumn('training_plans', 'replaced_by_plan_id', { transaction });
      await queryInterface.removeColumn('training_plans', 'cancel_reason', { transaction });
      await queryInterface.removeColumn('training_plans', 'cancelled_at', { transaction });
      await queryInterface.removeColumn('training_plans', 'source_plan_id', { transaction });
      await queryInterface.removeColumn('training_plans', 'metrics_snapshot', { transaction });
      await queryInterface.removeColumn('training_plans', 'config', { transaction });
      await queryInterface.removeColumn('training_plans', 'notes', { transaction });
      await queryInterface.removeColumn('training_plans', 'name', { transaction });

      // Drafts have no dates; the previous schema requires them, so they get
      // their creation day (status stays 'draft', which the old code accepts).
      await queryInterface.sequelize.query(
        `UPDATE training_plans
            SET start_date = COALESCE(start_date, created_at::date),
                end_date = COALESCE(end_date, created_at::date)
          WHERE start_date IS NULL OR end_date IS NULL;`,
        { transaction },
      );
      await queryInterface.changeColumn(
        'training_plans',
        'start_date',
        { type: Sequelize.DataTypes.DATEONLY, allowNull: false },
        { transaction },
      );
      await queryInterface.changeColumn(
        'training_plans',
        'end_date',
        { type: Sequelize.DataTypes.DATEONLY, allowNull: false },
        { transaction },
      );

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};
