import { Column, DataType, Model, Table } from 'sequelize-typescript';

/** A user opened the app (made an authenticated request) on this local day. */
@Table({ tableName: 'user_daily_activity', underscored: true, timestamps: false })
export class UserDailyActivity extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, field: 'user_id' })
  userId!: string;

  @Column({ type: DataType.DATEONLY, primaryKey: true })
  date!: string;

  @Column({ type: DataType.ARRAY(DataType.STRING(16)), allowNull: false, defaultValue: [] })
  platforms!: string[];

  @Column({ type: DataType.STRING(32), allowNull: true, field: 'app_version' })
  appVersion!: string | null;

  @Column({ type: DataType.DATE, allowNull: false, field: 'first_seen_at' })
  firstSeenAt!: Date;

  @Column({ type: DataType.DATE, allowNull: false, field: 'last_seen_at' })
  lastSeenAt!: Date;
}
