import { ApiHideProperty } from '@nestjs/swagger';
import { BelongsToMany, Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionGroup } from '@/modules/permissions/entities/permission-group.entity';
import { UserPermission } from '@/modules/permissions/entities/user-permission.entity';
import { UserPermissionGroup } from '@/modules/permissions/entities/user-permission-group.entity';

import { resolveUserStatus, type UserBlockReason } from '../user-status';

@Table({
  tableName: 'users',
  underscored: true,
  paranoid: true, // Soft delete as per guidelines
})
export class User extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  email!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  firstName!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  lastName!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'avatar_url',
  })
  avatarUrl!: string | null;

  @Column({ type: DataType.STRING(300), allowNull: true })
  bio!: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
    field: 'referral_code',
  })
  referralCode!: string | null;

  @ApiHideProperty()
  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'password_hash',
  })
  passwordHash!: string | null;

  @ApiHideProperty()
  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
    field: 'system_key',
  })
  systemKey!: string | null;

  @ApiHideProperty()
  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_system',
  })
  isSystem!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'email_verified',
  })
  emailVerified!: boolean;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'email_verified_at',
  })
  emailVerifiedAt!: Date | null;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'password_changed_at',
  })
  passwordChangedAt!: Date | null;

  /** Set while the account is blocked by an administrator; see `isUserBlocked`. */
  @Column({ type: DataType.DATE, allowNull: true, field: 'blocked_at' })
  blockedAt!: Date | null;

  /** End of a temporary block; null with `blockedAt` set means until unblocked. */
  @Column({ type: DataType.DATE, allowNull: true, field: 'blocked_until' })
  blockedUntil!: Date | null;

  @Column({ type: DataType.STRING(32), allowNull: true, field: 'blocked_reason' })
  blockedReason!: UserBlockReason | null;

  /** Visible to administrators only. */
  @Column({ type: DataType.STRING(500), allowNull: true, field: 'blocked_comment' })
  blockedComment!: string | null;

  @Column({ type: DataType.UUID, allowNull: true, field: 'blocked_by' })
  blockedBy!: string | null;

  @Column(DataType.DATE)
  createdAt!: Date;

  @Column(DataType.DATE)
  updatedAt!: Date;

  @BelongsToMany(() => Permission, () => UserPermission)
  individualPermissions!: Permission[];

  @BelongsToMany(() => PermissionGroup, () => UserPermissionGroup)
  permissionGroups!: PermissionGroup[];

  override toJSON(): Record<string, unknown> {
    const values = { ...this.get() } as Record<string, unknown>;
    delete values.passwordHash;
    // Who blocked the account and why is for administrators only (see the admin security endpoint).
    delete values.blockedComment;
    delete values.blockedBy;
    values.status = resolveUserStatus(this);
    // Only the admin panel serves soft-deleted users; for everyone else the marker is null.
    if (!values.deletedAt) {
      delete values.deletedAt;
    }
    return values;
  }
}
