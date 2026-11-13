import { BelongsToMany, Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { User } from '@/modules/users/entities/user.entity';

import { Permission } from './permission.entity';
import { PermissionGroupPermission } from './permission-group-permission.entity';
import { UserPermissionGroup } from './user-permission-group.entity';

@Table({
  tableName: 'permission_groups',
  underscored: true,
  paranoid: true,
})
export class PermissionGroup extends Model {
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
  name!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  description?: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    unique: true,
    field: 'system_key',
  })
  systemKey!: string | null;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_system',
  })
  isSystem!: boolean;

  @BelongsToMany(() => Permission, () => PermissionGroupPermission)
  permissions!: Permission[];

  @BelongsToMany(() => User, () => UserPermissionGroup)
  users!: User[];

  /** Soft-deleted rows are never served, so the marker is always null in responses. */
  override toJSON(): Record<string, unknown> {
    const values = { ...this.get() } as Record<string, unknown>;
    delete values.deletedAt;
    return values;
  }
}
