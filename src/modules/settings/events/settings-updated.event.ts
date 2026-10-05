import { ApiProperty } from '@nestjs/swagger';

import { AppSettingsSnapshot } from '../settings.constants';

/**
 * Emitted whenever global application settings change so that
 * realtime listeners can broadcast the new system UI state.
 */
export class SettingsUpdatedEvent {
  @ApiProperty({ type: Object })
  public readonly settings: AppSettingsSnapshot;

  @ApiProperty({ example: '2026-10-02T12:00:00.000Z' })
  public readonly updatedAt: string;

  constructor(settings: AppSettingsSnapshot) {
    this.settings = settings;
    this.updatedAt = new Date().toISOString();
  }
}
