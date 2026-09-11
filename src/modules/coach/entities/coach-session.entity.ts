import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

@Table({
  tableName: 'coach_sessions',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class CoachSession extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'user_id',
  })
  userId!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'athlete_id',
  })
  athleteId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  title!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  summary!: string | null;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    defaultValue: 'gpt-5',
  })
  model!: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
    field: 'last_message_at',
  })
  lastMessageAt!: Date | null;
}
