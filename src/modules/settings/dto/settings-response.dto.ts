import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { AppSettingsSnapshot, SETTINGS_LOCALES, SETTINGS_THEME_MODES } from '../settings.constants';

export class SettingsResponseDto {
  @ApiProperty({
    type: [String],
    example: [],
    description: 'Permission group ids assigned by default to new users',
  })
  defaultGroups!: string[];

  @ApiProperty({
    type: [String],
    example: [],
    description: 'Individual permission ids granted by default to new users',
  })
  defaultPermissions!: string[];

  @ApiProperty({
    enum: SETTINGS_THEME_MODES,
    example: 'light',
    description: 'Global UI theme mode',
  })
  theme!: (typeof SETTINGS_THEME_MODES)[number];

  @ApiProperty({
    enum: SETTINGS_LOCALES,
    example: 'en',
    description: 'Global UI locale',
  })
  locale!: (typeof SETTINGS_LOCALES)[number];
}

export class SettingsUpdatedResponseDto {
  @ApiPropertyOptional({ description: 'Updated setting key' })
  key?: string;

  @ApiPropertyOptional({ description: 'Updated setting value' })
  value?: unknown;
}

export type { AppSettingsSnapshot };
