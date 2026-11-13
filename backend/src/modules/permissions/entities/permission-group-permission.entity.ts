import { Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';

import { Permission } from './permission.entity';
import { PermissionGroup } from './permission-group.entity';

@Table({
  tableName: 'permission_group_permissions',
  underscored: true,
  timestamps: true,
})
export class PermissionGroupPermission extends Model {
  @ForeignKey(() => PermissionGroup)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    primaryKey: true,
  })
  permissionGroupId!: string;

  @ForeignKey(() => Permission)
  @Column({
    type: DataType.UUID,
    allowNull: false,
    primaryKey: true,
  })
  permissionId!: string;
}
