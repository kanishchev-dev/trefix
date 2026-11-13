import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type {
  NotificationChannel,
  NotificationDeliveryError,
  NotificationDeliveryStatus,
} from '../notifications.constants';

/** Push ticket of one device; the receipt check resolves it later. */
export interface PushTicketRecord {
  deviceId: string;
  ticketId: string | null;
  status: 'ok' | 'error';
  error?: string | null;
}

/** Delivery of a notification over one channel; one row per channel at most. */
@Table({ tableName: 'notification_deliveries', underscored: true, timestamps: true })
export class NotificationDelivery extends Model {
  @Column({ type: DataType.UUID, defaultValue: () => uuidv7(), primaryKey: true })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'notification_id' })
  notificationId!: string;

  @Column({ type: DataType.STRING(8), allowNull: false })
  channel!: NotificationChannel;

  @Column({ type: DataType.STRING(12), allowNull: false, defaultValue: 'pending' })
  status!: NotificationDeliveryStatus;

  @Column({ type: DataType.STRING(64), allowNull: true })
  error!: NotificationDeliveryError | null;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0 })
  attempts!: number;

  @Column({ type: DataType.JSONB, allowNull: true })
  tickets!: PushTicketRecord[] | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'sent_at' })
  sentAt!: Date | null;

  @Column(DataType.DATE)
  createdAt!: Date;

  @Column(DataType.DATE)
  updatedAt!: Date;
}
