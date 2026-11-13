import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { INTEGRATION_PROVIDERS, INTEGRATION_STATUSES } from '../constants/integrations.constants';

@Table({
  tableName: 'integrations',
  underscored: true,
  paranoid: true,
})
export class Integration extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'athlete_id',
  })
  athleteId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  provider!: (typeof INTEGRATION_PROVIDERS)[number];

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: INTEGRATION_STATUSES.DISCONNECTED,
  })
  status!: (typeof INTEGRATION_STATUSES)[keyof typeof INTEGRATION_STATUSES];

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'external_user_id',
  })
  externalUserId!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'access_token_encrypted',
  })
  accessTokenEncrypted!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'refresh_token_encrypted',
  })
  refreshTokenEncrypted!: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'access_token_expires_at',
  })
  accessTokenExpiresAt!: Date | null;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: [],
  })
  scopes!: string[];

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'connected_at',
  })
  connectedAt!: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'disconnected_at',
  })
  disconnectedAt!: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_sync_at',
  })
  lastSyncAt!: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_successful_sync_at',
  })
  lastSuccessfulSyncAt!: Date | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    field: 'last_sync_error',
  })
  lastSyncError!: string | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_profile_sync_at',
  })
  lastProfileSyncAt!: Date | null;

  /** Device providers: platform, app version, requested history depth, profile sync flag. */
  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: {},
  })
  metadata!: Record<string, unknown>;
}
