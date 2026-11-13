import { Column, DataType, Model, Table } from 'sequelize-typescript';
import { uuidv7 } from 'uuidv7';

import type { LlmCallStatus, LlmFeature } from '@/modules/openai/openai.events';

/** Token counters and cost of one LLM call. Append-only; holds no message text. */
@Table({ tableName: 'llm_usage', underscored: true, updatedAt: false })
export class LlmUsage extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: () => uuidv7() })
  id!: string;

  @Column({ type: DataType.UUID, allowNull: true, field: 'user_id' })
  userId!: string | null;

  @Column({ type: DataType.STRING(32), allowNull: false })
  feature!: LlmFeature;

  @Column({ type: DataType.STRING(64), allowNull: false })
  model!: string;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'input_tokens' })
  inputTokens!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'cached_input_tokens' })
  cachedInputTokens!: number;

  @Column({ type: DataType.INTEGER, allowNull: false, defaultValue: 0, field: 'output_tokens' })
  outputTokens!: number;

  @Column({ type: DataType.DECIMAL(12, 6), allowNull: false, defaultValue: 0, field: 'cost_usd' })
  costUsd!: string;

  @Column({ type: DataType.INTEGER, allowNull: true, field: 'latency_ms' })
  latencyMs!: number | null;

  @Column({ type: DataType.STRING(16), allowNull: false })
  status!: LlmCallStatus;

  @Column({ type: DataType.DATE, field: 'created_at' })
  createdAt!: Date;
}
