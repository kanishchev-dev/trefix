import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({
  tableName: 'app_settings',
  underscored: true,
})
export class AppSetting extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  key!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  value!: unknown;
}
