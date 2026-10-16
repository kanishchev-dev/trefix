import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { diffFields } from '@/common/utils/field-changes.util';
import { USERS_EVENTS } from '@/modules/users/users.events';

import {
  COACH_PROACTIVE_DEFAULTS,
  type CoachProactiveSettings,
  NOTIFICATION_DEFAULTS,
  type NotificationSettings,
} from '../users.constants';
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
    const before: Record<string, unknown> = { ...this.toResponse(preferences) };
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

    assign('distanceUnit');
    assign('weightUnit');
    assign('heightUnit');
    assign('temperatureUnit');
    assign('coachTone');
    assign('languageMode');
    assign('weekStart');
    assign('timeFormat');
    assign('coachEnabled');
    assign('coachAdaptationMode');
    assign('stravaProfileSync');
    assign('stravaActivitiesSync');
    assign('stravaGearSync');
    assign('timezone');
    assign('language');
    if (dto.coachQuietHours !== undefined) {
      const next = dto.coachQuietHours ? { from: dto.coachQuietHours.from, to: dto.coachQuietHours.to } : null;
      if (JSON.stringify(preferences.coachQuietHours) !== JSON.stringify(next)) {
        preferences.coachQuietHours = next;
        changedFields.push('coachQuietHours');
      }
    }

    if (dto.coachProactive) {
      const next: CoachProactiveSettings = { ...this.coachProactive(preferences), ...definedOnly(dto.coachProactive) };
      if (JSON.stringify(this.coachProactive(preferences)) !== JSON.stringify(next)) {
        preferences.coachProactive = next;
        changedFields.push('coachProactive');
      }
    }
    if (dto.notifications) {
      const next: NotificationSettings = { ...this.notifications(preferences), ...definedOnly(dto.notifications) };
      if (JSON.stringify(this.notifications(preferences)) !== JSON.stringify(next)) {
        preferences.notifications = next;
        changedFields.push('notifications');
      }
    }

    if (changedFields.length > 0) {
      await preferences.save();
      const after: Record<string, unknown> = { ...this.toResponse(preferences) };
      this.eventEmitter.emit(
        USERS_EVENTS.PREFERENCES_UPDATED,
        new PreferencesUpdatedEvent(userId, changedFields, diffFields(before, after, changedFields)),
      );
    }
    return this.toResponse(preferences);
  }

  private toResponse(preferences: UserPreferences): UserPreferencesResponseDto {
    return {
      distanceUnit: preferences.distanceUnit,
      weightUnit: preferences.weightUnit,
      heightUnit: preferences.heightUnit,
      temperatureUnit: preferences.temperatureUnit,
      weekStart: preferences.weekStart,
      timeFormat: preferences.timeFormat,
      coachEnabled: preferences.coachEnabled,
      coachAdaptationMode: preferences.coachAdaptationMode,
      coachTone: preferences.coachTone,
      coachProactive: this.coachProactive(preferences),
      coachQuietHours: preferences.coachQuietHours ?? null,
      notifications: this.notifications(preferences),
      stravaProfileSync: preferences.stravaProfileSync,
      stravaActivitiesSync: preferences.stravaActivitiesSync,
      stravaGearSync: preferences.stravaGearSync,
      timezone: preferences.timezone ?? null,
      language: preferences.language ?? null,
      languageMode: preferences.languageMode,
      updatedAt: preferences.updatedAt,
    };
  }

  /** Stored JSON merged over defaults, so topics added later start with their default value. */
  coachProactive(preferences: UserPreferences): CoachProactiveSettings {
    return { ...COACH_PROACTIVE_DEFAULTS, ...(preferences.coachProactive ?? {}) };
  }

  notifications(preferences: UserPreferences): NotificationSettings {
    return { ...NOTIFICATION_DEFAULTS, ...(preferences.notifications ?? {}) };
  }
}

function definedOnly<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}
