import { BelongsToMany, Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionGroup } from '@/modules/permissions/entities/permission-group.entity';
import { UserPermission } from '@/modules/permissions/entities/user-permission.entity';
import { UserPermissionGroup } from '@/modules/permissions/entities/user-permission-group.entity';

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

  @BelongsToMany(() => Permission, () => UserPermission)
  individualPermissions!: Permission[];

  @BelongsToMany(() => PermissionGroup, () => UserPermissionGroup)
  permissionGroups!: PermissionGroup[];
}
