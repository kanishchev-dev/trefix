import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

import { User } from '@/modules/users/entities/user.entity';

import { Permission } from './permission.entity';

@Table({
  tableName: 'user_permissions',
  underscored: true,
  timestamps: true,
})
export class UserPermission extends Model {
  @ForeignKey(() => User)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    primaryKey: true,
  })
  userId!: string;

  @ForeignKey(() => Permission)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    primaryKey: true,
  })
  permissionId!: string;
}
