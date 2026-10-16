import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsTimeZone, Matches, ValidateNested } from 'class-validator';

import {
  COACH_ADAPTATION_MODES,
  COACH_TONES,
  type CoachAdaptationMode,
  type CoachTone,
  PREFERENCE_DISTANCE_UNITS,
  PREFERENCE_HEIGHT_UNITS,
  PREFERENCE_LANGUAGE_MODES,
  PREFERENCE_LANGUAGES,
  PREFERENCE_TEMPERATURE_UNITS,
  PREFERENCE_TIME_FORMATS,
  PREFERENCE_WEEK_STARTS,
  PREFERENCE_WEIGHT_UNITS,
  type PreferenceDistanceUnit,
  type PreferenceHeightUnit,
  type PreferenceLanguage,
  type PreferenceLanguageMode,
  type PreferenceTemperatureUnit,
  type PreferenceTimeFormat,
  type PreferenceWeekStart,
  type PreferenceWeightUnit,
  QUIET_HOURS_TIME_PATTERN,
  WORKOUT_REMINDER_TIMES,
  type WorkoutReminderTime,
} from '../../users.constants';

export class QuietHoursDto {
  @ApiProperty({ example: '22:00', description: 'Start, HH:MM in the user time zone' })
  @Matches(QUIET_HOURS_TIME_PATTERN)
  from!: string;

  @ApiProperty({ example: '08:00', description: 'End, HH:MM in the user time zone' })
  @Matches(QUIET_HOURS_TIME_PATTERN)
  to!: string;
}

/** Partial update of proactive coach topics; omitted topics keep their value. */
export class UpdateCoachProactiveDto {
  @ApiPropertyOptional({ description: 'Reminder and tips before a planned workout' })
  @IsOptional()
  @IsBoolean()
  preWorkout?: boolean;

  @ApiPropertyOptional({ description: 'Review of a completed workout' })
  @IsOptional()
  @IsBoolean()
  workoutReview?: boolean;

  @ApiPropertyOptional({ description: 'Asks how the workout felt (RPE)' })
  @IsOptional()
  @IsBoolean()
  wellbeingCheck?: boolean;

  @ApiPropertyOptional({ description: 'Summary of the training week' })
  @IsOptional()
  @IsBoolean()
  weeklySummary?: boolean;

  @ApiPropertyOptional({ description: 'Support after missed workouts' })
  @IsOptional()
  @IsBoolean()
  missedSupport?: boolean;
}

export class CoachProactiveDto {
  @ApiProperty() preWorkout!: boolean;
  @ApiProperty() workoutReview!: boolean;
  @ApiProperty() wellbeingCheck!: boolean;
  @ApiProperty() weeklySummary!: boolean;
  @ApiProperty() missedSupport!: boolean;
}

/** Partial update of notification settings; omitted fields keep their value. */
export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ description: 'Remind about planned workouts' })
  @IsOptional()
  @IsBoolean()
  workoutReminder?: boolean;

  @ApiPropertyOptional({ enum: WORKOUT_REMINDER_TIMES, description: 'Morning of the day or a lead time' })
  @IsOptional()
  @IsIn(WORKOUT_REMINDER_TIMES)
  workoutReminderTime?: WorkoutReminderTime;

  @ApiPropertyOptional({ description: 'A planned workout became missed (48 h grace)' })
  @IsOptional()
  @IsBoolean()
  missedWorkout?: boolean;

  @ApiPropertyOptional({ description: 'The active plan was changed' })
  @IsOptional()
  @IsBoolean()
  planChanged?: boolean;

  @ApiPropertyOptional({ description: 'New records and achievements' })
  @IsOptional()
  @IsBoolean()
  achievements?: boolean;

  @ApiPropertyOptional({ description: 'A workout was imported from a connected service' })
  @IsOptional()
  @IsBoolean()
  workoutSynced?: boolean;
}

export class NotificationSettingsDto {
  @ApiProperty() workoutReminder!: boolean;
  @ApiProperty({ enum: WORKOUT_REMINDER_TIMES, example: 'morning' }) workoutReminderTime!: WorkoutReminderTime;
  @ApiProperty() missedWorkout!: boolean;
  @ApiProperty() planChanged!: boolean;
  @ApiProperty() achievements!: boolean;
  @ApiProperty() workoutSynced!: boolean;
}

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({ enum: PREFERENCE_DISTANCE_UNITS })
  @IsOptional()
  @IsIn(PREFERENCE_DISTANCE_UNITS)
  distanceUnit?: PreferenceDistanceUnit;

  @ApiPropertyOptional({ enum: PREFERENCE_WEIGHT_UNITS })
  @IsOptional()
  @IsIn(PREFERENCE_WEIGHT_UNITS)
  weightUnit?: PreferenceWeightUnit;

  @ApiPropertyOptional({ enum: PREFERENCE_HEIGHT_UNITS })
  @IsOptional()
  @IsIn(PREFERENCE_HEIGHT_UNITS)
  heightUnit?: PreferenceHeightUnit;

  @ApiPropertyOptional({ enum: PREFERENCE_TEMPERATURE_UNITS })
  @IsOptional()
  @IsIn(PREFERENCE_TEMPERATURE_UNITS)
  temperatureUnit?: PreferenceTemperatureUnit;

  @ApiPropertyOptional({ enum: PREFERENCE_WEEK_STARTS })
  @IsOptional()
  @IsIn(PREFERENCE_WEEK_STARTS)
  weekStart?: PreferenceWeekStart;

  @ApiPropertyOptional({ enum: PREFERENCE_TIME_FORMATS })
  @IsOptional()
  @IsIn(PREFERENCE_TIME_FORMATS)
  timeFormat?: PreferenceTimeFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  coachEnabled?: boolean;

  @ApiPropertyOptional({ enum: COACH_ADAPTATION_MODES })
  @IsOptional()
  @IsIn(COACH_ADAPTATION_MODES)
  coachAdaptationMode?: CoachAdaptationMode;

  @ApiPropertyOptional({ enum: COACH_TONES })
  @IsOptional()
  @IsIn(COACH_TONES)
  coachTone?: CoachTone;

  @ApiPropertyOptional({ type: UpdateCoachProactiveDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateCoachProactiveDto)
  coachProactive?: UpdateCoachProactiveDto;

  @ApiPropertyOptional({ type: QuietHoursDto, nullable: true, description: '`null` turns quiet hours off' })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  coachQuietHours?: QuietHoursDto | null;

  @ApiPropertyOptional({ type: UpdateNotificationSettingsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateNotificationSettingsDto)
  notifications?: UpdateNotificationSettingsDto;

  @ApiPropertyOptional({ description: 'Weight and sex from Strava' })
  @IsOptional()
  @IsBoolean()
  stravaProfileSync?: boolean;

  @ApiPropertyOptional({ description: 'Import new Strava activities' })
  @IsOptional()
  @IsBoolean()
  stravaActivitiesSync?: boolean;

  @ApiPropertyOptional({ description: 'Shoes and mileage from Strava' })
  @IsOptional()
  @IsBoolean()
  stravaGearSync?: boolean;

  @ApiPropertyOptional({ example: 'Europe/Moscow', description: 'IANA time zone of the device' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({
    enum: PREFERENCE_LANGUAGES,
    description: 'Resolved app language; coach messages and emails are written in it',
  })
  @IsOptional()
  @IsIn(PREFERENCE_LANGUAGES)
  language?: PreferenceLanguage;

  @ApiPropertyOptional({
    enum: PREFERENCE_LANGUAGE_MODES,
    description: 'Language picked in the app; `system` follows the device. Clients still report `language`',
  })
  @IsOptional()
  @IsIn(PREFERENCE_LANGUAGE_MODES)
  languageMode?: PreferenceLanguageMode;
}

export class UserPreferencesResponseDto {
  @ApiProperty({ enum: PREFERENCE_DISTANCE_UNITS, example: 'km' })
  distanceUnit!: PreferenceDistanceUnit;

  @ApiProperty({ enum: PREFERENCE_WEIGHT_UNITS, example: 'kg' })
  weightUnit!: PreferenceWeightUnit;

  @ApiProperty({ enum: PREFERENCE_HEIGHT_UNITS, example: 'cm' })
  heightUnit!: PreferenceHeightUnit;

  @ApiProperty({ enum: PREFERENCE_TEMPERATURE_UNITS, example: 'c' })
  temperatureUnit!: PreferenceTemperatureUnit;

  @ApiProperty({ enum: PREFERENCE_WEEK_STARTS, example: 'mon' })
  weekStart!: PreferenceWeekStart;

  @ApiProperty({ enum: PREFERENCE_TIME_FORMATS, example: '24h' })
  timeFormat!: PreferenceTimeFormat;

  @ApiProperty({ example: true })
  coachEnabled!: boolean;

  @ApiProperty({ enum: COACH_ADAPTATION_MODES, example: 'confirm' })
  coachAdaptationMode!: CoachAdaptationMode;

  @ApiProperty({ enum: COACH_TONES, example: 'neutral' })
  coachTone!: CoachTone;

  @ApiProperty({ type: CoachProactiveDto })
  coachProactive!: CoachProactiveDto;

  @ApiProperty({ type: QuietHoursDto, nullable: true, example: { from: '22:00', to: '08:00' } })
  coachQuietHours!: QuietHoursDto | null;

  @ApiProperty({ type: NotificationSettingsDto })
  notifications!: NotificationSettingsDto;

  @ApiProperty({ example: true })
  stravaProfileSync!: boolean;

  @ApiProperty({ example: true })
  stravaActivitiesSync!: boolean;

  @ApiProperty({ example: true })
  stravaGearSync!: boolean;

  @ApiProperty({ type: String, nullable: true, example: 'Europe/Moscow' })
  timezone!: string | null;

  @ApiProperty({ enum: PREFERENCE_LANGUAGES, nullable: true, example: 'ru' })
  language!: PreferenceLanguage | null;

  @ApiProperty({ enum: PREFERENCE_LANGUAGE_MODES, example: 'system' })
  languageMode!: PreferenceLanguageMode;

  @ApiProperty()
  updatedAt!: Date;
}
