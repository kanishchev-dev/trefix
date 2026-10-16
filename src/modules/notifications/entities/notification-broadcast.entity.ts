import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type {
  BroadcastAudience,
  BroadcastStatus,
  NotificationChannel,
  NotificationContent,
  NotificationLink,
} from '../notifications.constants';

/** A notification an administrator sent to one or many users. */
@Table({ tableName: 'notification_broadcasts', underscored: true, timestamps: true })
export class NotificationBroadcast extends Model {
  @Column({ type: DataType.UUID, defaultValue: () => uuidv7(), primaryKey: true })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: true, field: 'created_by' })
  createdBy!: string | null;

  @Column({ type: DataType.JSONB, allowNull: false })
  audience!: BroadcastAudience;

  @Column({ type: DataType.JSONB, allowNull: false })
  content!: NotificationContent;

  @Column({ type: DataType.JSONB, allowNull: true })
  link!: NotificationLink | null;

  @Column({ type: DataType.ARRAY(DataType.STRING(8)), allowNull: false })
  channels!: NotificationChannel[];

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'queued' })
  status!: BroadcastStatus;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'recipients_count' })
  recipientsCount!: number;

  @Column({ type: DataType.STRING(500), allowNull: true })
  error!: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'completed_at' })
  completedAt!: Date | null;

  @Column(DataType.DATE)
  createdAt!: Date;

  @Column(DataType.DATE)
  updatedAt!: Date;
}
