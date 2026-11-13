import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { ActivitySourceChannel, ActorType } from '@/common/context/activity-context';
import type { FieldChanges } from '@/common/utils/field-changes.util';

import type { ActivityDomain } from '../activity.constants';

export interface ActivityClientInfo {
  platform: string | null;
  appVersion: string | null;
  device: string | null;
}

/**
 * One entry of the activity history. Append-only: rows are never updated, and
 * only the retention job deletes them.
 */
@Table({ tableName: 'activity_events', underscored: true, timestamps: false })
export class ActivityEvent extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: () => uuidv7() })
  id!: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'occurred_at' })
  occurredAt!: Date;

  /** Whose history this is; null for system-wide actions such as settings changes. */
  @Column({ type: DataType.UUID, allowNull: true, field: 'subject_user_id' })
  subjectUserId!: string | null;

  @Column({ type: DataType.STRING(16), allowNull: false, field: 'actor_type' })
  actorType!: ActorType;

  @Column({ type: DataType.UUID, allowNull: true, field: 'actor_user_id' })
  actorUserId!: string | null;

  /** Name of the domain event that produced the entry. */
  @Column({ type: DataType.STRING(64), allowNull: false })
  action!: string;

  @Column({ type: DataType.STRING(24), allowNull: false })
  domain!: ActivityDomain;

  @Column({ type: DataType.STRING(32), allowNull: true, field: 'entity_type' })
  entityType!: string | null;

  @Column({ type: DataType.STRING(64), allowNull: true, field: 'entity_id' })
  entityId!: string | null;

  @Column({ type: DataType.JSONB, allowNull: true })
  changes!: FieldChanges | null;

  /** Short labels to render the entry without joins; never secrets or message text. */
  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: {} })
  metadata!: Record<string, unknown>;

  @Column({ type: DataType.STRING(16), allowNull: false })
  source!: ActivitySourceChannel;

  @Column({ type: DataType.JSONB, allowNull: true })
  client!: ActivityClientInfo | null;

  @Column({ type: DataType.INET, allowNull: true })
  ip!: string | null;

  @Column({ type: DataType.STRING(128), allowNull: true, field: 'trace_id' })
  traceId!: string | null;
}
