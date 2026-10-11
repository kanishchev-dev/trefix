import { Column, DataType, Model, Table } from 'sequelize-typescript';

import {
  COACH_ADAPTATION_MODE_DEFAULT,
  type CoachAdaptationMode,
  type PreferenceLanguage,
  type PreferenceTimeFormat,
  type PreferenceUnits,
  type PreferenceWeekStart,
  type QuietHours,
} from '../users.constants';

/** Per-user app settings shared across devices. Values are stored metric; `units` only affects display. */
@Table({
  tableName: 'user_preferences',
  underscored: true,
})
export class UserPreferences extends Model {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    field: 'user_id',
  })
  userId!: string;

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: 'metric' })
  units!: PreferenceUnits;

  @Column({ type: DataType.STRING(8), allowNull: false, defaultValue: 'mon', field: 'week_start' })
  weekStart!: PreferenceWeekStart;

  @Column({ type: DataType.STRING(8), allowNull: false, defaultValue: '24h', field: 'time_format' })
  timeFormat!: PreferenceTimeFormat;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true, field: 'coach_enabled' })
  coachEnabled!: boolean;

  @Column({
    type: DataType.STRING(16),
    allowNull: false,
    defaultValue: COACH_ADAPTATION_MODE_DEFAULT,
    field: 'coach_adaptation_mode',
  })
  coachAdaptationMode!: CoachAdaptationMode;

  @Column({ type: DataType.JSONB, allowNull: true, field: 'coach_quiet_hours' })
  coachQuietHours!: QuietHours | null;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true, field: 'strava_profile_sync' })
  stravaProfileSync!: boolean;

  /**
   * Language of texts generated without a request — coach messages, emails.
   * Null until the client reports it; responses to requests follow `Accept-Language` instead.
   */
  @Column({ type: DataType.STRING(8), allowNull: true })
  language!: PreferenceLanguage | null;

  /** IANA time zone reported by the client; quiet hours are evaluated in it. */
  @Column({ type: DataType.STRING(64), allowNull: true })
  timezone!: string | null;
}
