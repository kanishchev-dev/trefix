import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { DataExportStatus } from './data-export.constants';

/** A requested archive of the user's data; the link to it is emailed when it is ready. */
@Table({ tableName: 'data_exports', underscored: true })
export class DataExport extends Model {
  @Column({ type: DataType.UUID, defaultValue: () => uuidv7(), primaryKey: true })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId!: string;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'pending' })
  status!: DataExportStatus;

  @Column({ type: DataType.UUID, allowNull: true, field: 'file_id' })
  fileId!: string | null;

  /** SHA-256 of the token in the emailed link; the link works without signing in. */
  @Column({ type: DataType.STRING(64), allowNull: true, field: 'download_token_hash' })
  downloadTokenHash!: string | null;

  @Column({ type: DataType.STRING(255), allowNull: true })
  error!: string | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'ready_at' })
  readyAt!: Date | null;

  @Column({ type: DataType.DATE, allowNull: true, field: 'expires_at' })
  expiresAt!: Date | null;

  declare createdAt: Date;
}
