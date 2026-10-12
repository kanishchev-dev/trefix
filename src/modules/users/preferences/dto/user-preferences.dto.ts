import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsTimeZone, Matches, ValidateNested } from 'class-validator';

import {
  COACH_ADAPTATION_MODES,
  type CoachAdaptationMode,
  PREFERENCE_LANGUAGES,
  PREFERENCE_TIME_FORMATS,
  PREFERENCE_UNITS,
  PREFERENCE_WEEK_STARTS,
  type PreferenceLanguage,
  type PreferenceTimeFormat,
  type PreferenceUnits,
  type PreferenceWeekStart,
  QUIET_HOURS_TIME_PATTERN,
} from '../../users.constants';

export class QuietHoursDto {
  @ApiProperty({ example: '22:00', description: 'Start, HH:MM in the user time zone' })
  @Matches(QUIET_HOURS_TIME_PATTERN)
  from!: string;

  @ApiProperty({ example: '08:00', description: 'End, HH:MM in the user time zone' })
  @Matches(QUIET_HOURS_TIME_PATTERN)
  to!: string;
}

export class UpdateUserPreferencesDto {
  @ApiPropertyOptional({ enum: PREFERENCE_UNITS })
  @IsOptional()
  @IsIn(PREFERENCE_UNITS)
  units?: PreferenceUnits;

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

  @ApiPropertyOptional({ type: QuietHoursDto, nullable: true, description: '`null` turns quiet hours off' })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuietHoursDto)
  coachQuietHours?: QuietHoursDto | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stravaProfileSync?: boolean;

  @ApiPropertyOptional({ example: 'Europe/Moscow', description: 'IANA time zone of the device' })
  @IsOptional()
  @IsTimeZone()
  timezone?: string;

  @ApiPropertyOptional({
    enum: PREFERENCE_LANGUAGES,
    description: 'App language; coach messages and emails are written in it',
  })
  @IsOptional()
  @IsIn(PREFERENCE_LANGUAGES)
  language?: PreferenceLanguage;
}

export class UserPreferencesResponseDto {
  @ApiProperty({ enum: PREFERENCE_UNITS, example: 'metric' })
  units!: PreferenceUnits;

  @ApiProperty({ enum: PREFERENCE_WEEK_STARTS, example: 'mon' })
  weekStart!: PreferenceWeekStart;

  @ApiProperty({ enum: PREFERENCE_TIME_FORMATS, example: '24h' })
  timeFormat!: PreferenceTimeFormat;

  @ApiProperty({ example: true })
  coachEnabled!: boolean;

  @ApiProperty({ enum: COACH_ADAPTATION_MODES, example: 'confirm' })
  coachAdaptationMode!: CoachAdaptationMode;

  @ApiProperty({ type: QuietHoursDto, nullable: true, example: { from: '22:00', to: '08:00' } })
  coachQuietHours!: QuietHoursDto | null;

  @ApiProperty({ example: true })
  stravaProfileSync!: boolean;

  @ApiProperty({ type: String, nullable: true, example: 'Europe/Moscow' })
  timezone!: string | null;

  @ApiProperty({ enum: PREFERENCE_LANGUAGES, nullable: true, example: 'ru' })
  language!: PreferenceLanguage | null;

  @ApiProperty()
  updatedAt!: Date;
}
