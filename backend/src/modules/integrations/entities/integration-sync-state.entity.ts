import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { SYNC_STATUSES, SYNC_TYPES } from '../constants/integrations.constants';

@Table({
  tableName: 'integration_sync_states',
  underscored: true,
})
export class IntegrationSyncState extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'integration_id',
  })
  integrationId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  syncType!: (typeof SYNC_TYPES)[keyof typeof SYNC_TYPES];

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  cursor!: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 1,
  })
  page!: number;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'started_at',
  })
  startedAt!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'completed_at',
  })
  completedAt!: Date | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'processed_count',
  })
  processedCount!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'imported_count',
  })
  importedCount!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'skipped_count',
  })
  skippedCount!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'failed_count',
  })
  failedCount!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: SYNC_STATUSES.PENDING,
  })
  status!: (typeof SYNC_STATUSES)[keyof typeof SYNC_STATUSES];

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  error!: string | null;
}
