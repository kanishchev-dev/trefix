import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { PushPlatform } from '../notifications.constants';

/**
 * An app installation that receives pushes. Bound to the auth session it was
 * registered from: signing out of that session removes the device.
 */
@Table({ tableName: 'push_devices', underscored: true, timestamps: true })
export class PushDevice extends Model {
  @Column({ type: DataType.UUID, defaultValue: () => uuidv7(), primaryKey: true })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId!: string;

  @Column({ type: DataType.STRING(64), allowNull: true, field: 'session_id' })
  sessionId!: string | null;

  /** Expo push token (`ExponentPushToken[...]`). */
  @Column({ type: DataType.STRING(255), allowNull: false, unique: true })
  token!: string;

  @Column({ type: DataType.STRING(8), allowNull: false })
  platform!: PushPlatform;

  @Column({ type: DataType.STRING(8), allowNull: true })
  locale!: string | null;

  @Column({ type: DataType.STRING(32), allowNull: true, field: 'app_version' })
  appVersion!: string | null;

  @Column({ type: DataType.STRING(100), allowNull: true, field: 'device_name' })
  deviceName!: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'last_seen_at' })
  lastSeenAt!: Date;

  @Column(DataType.DATE)
  createdAt!: Date;

  @Column(DataType.DATE)
  updatedAt!: Date;
}
