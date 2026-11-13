import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import { COACH_MESSAGE_ROLES, type CoachToolName } from '../coach.constants';

@Table({
  tableName: 'coach_messages',
  underscored: true,
  timestamps: true,
  paranoid: true,
})
export class CoachMessage extends Model {
  @Column({
    type: DataType.UUID,
    defaultValue: () => uuidv7(),
    primaryKey: true,
  })
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
    field: 'session_id',
  })
  sessionId!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  role!: (typeof COACH_MESSAGE_ROLES)[number];

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  content!: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'tool_name',
  })
  toolName!: CoachToolName | null;

  @Column({
    type: DataType.STRING,
    allowNull: true,
    field: 'tool_call_id',
  })
  toolCallId!: string | null;

  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: {},
  })
  metadata!: Record<string, unknown>;
}
