import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { UpdateUserPreferencesDto, UserPreferencesResponseDto } from './dto/user-preferences.dto';
import { PreferencesUpdatedEvent } from './events/preferences-updated.event';
import { UserPreferences } from './user-preferences.entity';

/** Reads and updates per-user preferences; the row is created lazily on first access. */
@Injectable()
export class UserPreferencesService {
  constructor(
    @InjectModel(UserPreferences)
    private readonly preferencesModel: typeof UserPreferences,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getEntity(userId: string): Promise<UserPreferences> {
    const [preferences] = await this.preferencesModel.findOrCreate({ where: { userId }, defaults: { userId } });
    return preferences;
  }

  async get(userId: string): Promise<UserPreferencesResponseDto> {
    return this.toResponse(await this.getEntity(userId));
  }

  async update(userId: string, dto: UpdateUserPreferencesDto): Promise<UserPreferencesResponseDto> {
    const preferences = await this.getEntity(userId);
    const changedFields: string[] = [];
    const assign = <K extends keyof UpdateUserPreferencesDto & keyof UserPreferences>(key: K): void => {
      const value = dto[key];
      if (value === undefined) {
        return;
      }
      const next = (value === null ? null : value) as UserPreferences[K];
      if (JSON.stringify(preferences[key]) !== JSON.stringify(next)) {
        preferences.set(key, next);
        changedFields.push(key);
      }
    };

    assign('units');
    assign('weekStart');
    assign('timeFormat');
    assign('coachEnabled');
    assign('coachAdaptationMode');
    assign('stravaProfileSync');
    assign('timezone');
    if (dto.coachQuietHours !== undefined) {
      const next = dto.coachQuietHours ? { from: dto.coachQuietHours.from, to: dto.coachQuietHours.to } : null;
      if (JSON.stringify(preferences.coachQuietHours) !== JSON.stringify(next)) {
        preferences.coachQuietHours = next;
        changedFields.push('coachQuietHours');
      }
    }

    if (changedFields.length > 0) {
      await preferences.save();
      this.eventEmitter.emit('preferences.updated', new PreferencesUpdatedEvent(userId, changedFields));
    }
    return this.toResponse(preferences);
  }

  private toResponse(preferences: UserPreferences): UserPreferencesResponseDto {
    return {
      units: preferences.units,
      weekStart: preferences.weekStart,
      timeFormat: preferences.timeFormat,
      coachEnabled: preferences.coachEnabled,
      coachAdaptationMode: preferences.coachAdaptationMode,
      coachQuietHours: preferences.coachQuietHours ?? null,
      stravaProfileSync: preferences.stravaProfileSync,
      timezone: preferences.timezone ?? null,
      updatedAt: preferences.updatedAt,
    };
  }
}
