import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

import { User } from '@/modules/users/entities/user.entity';

import { PermissionGroup } from './permission-group.entity';

@Table({
  tableName: 'user_permission_groups',
  underscored: true,
  timestamps: true,
})
export class UserPermissionGroup extends Model {
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    primaryKey: true,
  })
  userId!: string;

  @ForeignKey(() => PermissionGroup)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    primaryKey: true,
  })
  permissionGroupId!: string;
}
