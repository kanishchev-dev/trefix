import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { WEBHOOK_EVENT_STATUSES } from '../constants/integrations.constants';

@Table({
  tableName: 'strava_webhook_events',
  underscored: true,
})
export class StravaWebhookEvent extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'subscription_id',
  })
  subscriptionId!: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'object_type',
  })
  objectType!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'object_id',
  })
  objectId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'aspect_type',
  })
  aspectType!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    field: 'owner_id',
  })
  ownerId!: string;

  @Column({
    type: DataType.BIGINT,
    allowNull: false,
    field: 'event_time',
  })
  eventTime!: number;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: {},
  })
  updates!: Record<string, unknown>;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  fingerprint!: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    field: 'received_at',
  })
  receivedAt!: Date;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'processed_at',
  })
  processedAt!: Date | null;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: WEBHOOK_EVENT_STATUSES.PENDING,
  })
  status!: (typeof WEBHOOK_EVENT_STATUSES)[keyof typeof WEBHOOK_EVENT_STATUSES];

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  attempts!: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  error!: string | null;
}
