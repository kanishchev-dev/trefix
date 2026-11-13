import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { AuthSocialProvider } from '../interfaces/auth-social-provider.interface';

/** A social account (Apple, Google) the user signs in with; one per provider. */
@Table({ tableName: 'user_identities', underscored: true })
export class UserIdentity extends Model {
  @Column({ type: DataType.UUID, defaultValue: () => uuidv7(), primaryKey: true })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: false, field: 'user_id' })
  userId!: string;

  @Column({ type: DataType.STRING(16), allowNull: false })
  provider!: AuthSocialProvider;

  /** Stable account id at the provider (`sub`); emails behind it may change. */
  @Column({ type: DataType.STRING(255), allowNull: false })
  subject!: string;

  /** Email the provider reported at linking; Apple may give a private relay address. */
  @Column({ type: DataType.STRING(255), allowNull: true })
  email!: string | null;

  declare createdAt: Date;
}
