import { BelongsToMany, Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { User } from '@/modules/users/entities/user.entity';

import { PermissionGroup } from './permission-group.entity';
import { PermissionGroupPermission } from './permission-group-permission.entity';
import { UserPermission } from './user-permission.entity';

@Table({
  tableName: 'permissions',
  underscored: true,
  paranoid: true,
})
export class Permission extends Model {
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

  @BelongsToMany(() => PermissionGroup, () => PermissionGroupPermission)
  groups!: PermissionGroup[];

  @BelongsToMany(() => User, () => UserPermission)
  users!: User[];

  /** Soft-deleted rows are never served, so the marker is always null in responses. */
  override toJSON(): Record<string, unknown> {
    const values = { ...this.get() } as Record<string, unknown>;
    delete values.deletedAt;
    return values;
  }
}
