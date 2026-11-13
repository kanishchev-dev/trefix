import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { ConsentType } from './consents.constants';

export interface ConsentClientInfo {
  platform?: string;
  appVersion?: string;
  locale?: string;
}

/** One acceptance of a consent text version; revoking sets `revoked_at`, history is kept. */
@Table({
  tableName: 'user_consents',
  underscored: true,
})
export class UserConsent extends Model {
  @Column({ type: DataType.UUID, defaultValue: () => uuidv7(), primaryKey: true })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId!: string;

  @Column({ type: DataType.STRING(32), allowNull: false })
  type!: ConsentType;

  @Column({ type: DataType.STRING(20), allowNull: false })
  version!: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'accepted_at' })
  acceptedAt!: Date;

  @Column({ type: DataType.DATE, allowNull: true, field: 'revoked_at' })
  revokedAt!: Date | null;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  client!: ConsentClientInfo;
}
