import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

@Table({
  tableName: 'storage_files',
  underscored: true,
  paranoid: true,
})
export class StorageFile extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  originalName!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  mimeType!: string;

  @Column({
    type: DataType.BIGINT,
    allowNull: false,
    get(this: StorageFile): number {
      const rawValue = this.getDataValue('size');
      return typeof rawValue === 'string' ? Number(rawValue) : Number(rawValue ?? 0);
    },
  })
  size!: number;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  storageKey!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  uploaderUserId?: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  scopeType?: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  scopeId?: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  folder?: string | null;
}
