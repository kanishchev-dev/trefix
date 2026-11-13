import { ApiPropertyOptional } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsIn, IsOptional, IsUUID } from 'class-validator';

import { SETTINGS_LOCALES, SETTINGS_THEME_MODES } from '../settings.constants';

export class UpdateSettingsDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Permission group ids assigned by default to new users',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  defaultGroups?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Individual permission ids granted by default to new users',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('all', { each: true })
  defaultPermissions?: string[];

  @ApiPropertyOptional({
    enum: SETTINGS_THEME_MODES,
    description: 'Global UI theme mode',
  })
  @IsOptional()
  @IsIn(SETTINGS_THEME_MODES)
  theme?: (typeof SETTINGS_THEME_MODES)[number];

  @ApiPropertyOptional({
    enum: SETTINGS_LOCALES,
    description: 'Global UI locale',
  })
  @IsOptional()
  @IsIn(SETTINGS_LOCALES)
  locale?: (typeof SETTINGS_LOCALES)[number];
}
