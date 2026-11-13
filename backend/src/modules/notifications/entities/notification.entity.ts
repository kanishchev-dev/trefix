import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type {
  NotificationCategory,
  NotificationContent,
  NotificationLink,
  NotificationType,
} from '../notifications.constants';

/** An entry of the user's inbox. Hard-deleted by the user or by retention. */
@Table({ tableName: 'notifications', underscored: true, timestamps: true })
export class Notification extends Model {
  @Column({ type: DataType.UUID, defaultValue: () => uuidv7(), primaryKey: true })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId!: string;

  @Column({ type: DataType.UUID, allowNull: true, field: 'broadcast_id' })
  broadcastId!: string | null;

  @Column({ type: DataType.STRING(16), allowNull: false })
  category!: NotificationCategory;

  @Column({ type: DataType.STRING(48), allowNull: false })
  type!: NotificationType;

  /** Texts written by a person or rendered once (coach); system types carry `params` instead. */
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  content!: NotificationContent;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  params!: Record<string, string | number | boolean | null>;

  @Column({ type: DataType.JSONB, allowNull: true })
  link!: NotificationLink | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'read_at' })
  readAt!: Date | null;

  @Column(DataType.DATE)
  createdAt!: Date;

  @Column(DataType.DATE)
  updatedAt!: Date;
}
