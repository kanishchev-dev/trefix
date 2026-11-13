import { Column, DataType, Model, Table } from 'sequelize-typescript';

/** A metric too heavy to compute per request, precomputed for one day. */
@Table({ tableName: 'analytics_daily_metrics', underscored: true, timestamps: false })
export class AnalyticsDailyMetric extends Model {
  @Column({ type: DataType.DATEONLY, primaryKey: true })
  date!: string;

  @Column({ type: DataType.STRING(48), primaryKey: true })
  metric!: string;

  @Column({ type: DataType.STRING(48), primaryKey: true, defaultValue: '' })
  dimension!: string;

  @Column({ type: DataType.DECIMAL, allowNull: false })
  value!: string;

  @Column({ type: DataType.DATE, allowNull: false, field: 'computed_at' })
  computedAt!: Date;
}
