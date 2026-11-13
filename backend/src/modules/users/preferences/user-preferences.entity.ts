import { Column, DataType, Model, Table } from 'sequelize-typescript';

import {
  COACH_ADAPTATION_MODE_DEFAULT,
  COACH_PROACTIVE_DEFAULTS,
  COACH_TONE_DEFAULT,
  type CoachAdaptationMode,
  type CoachProactiveSettings,
  type CoachTone,
  NOTIFICATION_DEFAULTS,
  type NotificationSettings,
  type PreferenceDistanceUnit,
  type PreferenceHeightUnit,
  type PreferenceLanguage,
  type PreferenceLanguageMode,
  type PreferenceTemperatureUnit,
  type PreferenceTimeFormat,
  type PreferenceWeekStart,
  type PreferenceWeightUnit,
  type QuietHours,
} from '../users.constants';

/** Per-user app settings shared across devices. Values are stored metric; units only affect display. */
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

  @Column({ type: DataType.STRING(4), allowNull: false, defaultValue: 'km', field: 'distance_unit' })
  distanceUnit!: PreferenceDistanceUnit;

  @Column({ type: DataType.STRING(4), allowNull: false, defaultValue: 'kg', field: 'weight_unit' })
  weightUnit!: PreferenceWeightUnit;

  @Column({ type: DataType.STRING(4), allowNull: false, defaultValue: 'cm', field: 'height_unit' })
  heightUnit!: PreferenceHeightUnit;

  @Column({ type: DataType.STRING(4), allowNull: false, defaultValue: 'c', field: 'temperature_unit' })
  temperatureUnit!: PreferenceTemperatureUnit;

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

  @Column({ type: DataType.STRING(16), allowNull: false, defaultValue: COACH_TONE_DEFAULT, field: 'coach_tone' })
  coachTone!: CoachTone;

  /** Which kinds of messages the coach may start on its own. */
  @Column({
    type: DataType.JSONB,
    allowNull: false,
    defaultValue: COACH_PROACTIVE_DEFAULTS,
    field: 'coach_proactive',
  })
  coachProactive!: CoachProactiveSettings;

  @Column({ type: DataType.JSONB, allowNull: false, defaultValue: NOTIFICATION_DEFAULTS })
  notifications!: NotificationSettings;

  @Column({ type: DataType.JSONB, allowNull: true, field: 'coach_quiet_hours' })
  coachQuietHours!: QuietHours | null;

  /** Weight and sex from the Strava profile. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true, field: 'strava_profile_sync' })
  stravaProfileSync!: boolean;

  /** New and edited Strava activities are imported. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true, field: 'strava_activities_sync' })
  stravaActivitiesSync!: boolean;

  /** Shoes and their mileage from the Strava profile. */
  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: true, field: 'strava_gear_sync' })
  stravaGearSync!: boolean;

  /**
   * Language of texts generated without a request — coach messages, emails.
   * Null until the client reports it; responses to requests follow `Accept-Language` instead.
   */
  @Column({ type: DataType.STRING(8), allowNull: true })
  language!: PreferenceLanguage | null;

  /** The choice shown in the app; `language` keeps the resolved one so server texts never depend on it. */
  @Column({ type: DataType.STRING(8), allowNull: false, defaultValue: 'system', field: 'language_mode' })
  languageMode!: PreferenceLanguageMode;

  /** IANA time zone reported by the client; quiet hours are evaluated in it. */
  @Column({ type: DataType.STRING(64), allowNull: true })
  timezone!: string | null;
}
