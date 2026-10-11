import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';
import { Permission } from '@/modules/permissions/entities/permission.entity';
import { PermissionGroup } from '@/modules/permissions/entities/permission-group.entity';

import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AppSetting } from './entities/app-setting.entity';
import { SettingsUpdatedEvent } from './events/settings-updated.event';
import {
  AppSettingsSnapshot,
  DEFAULT_APP_SETTINGS,
  SETTINGS_KEY_DEFAULT_GROUPS,
  SETTINGS_KEY_DEFAULT_PERMISSIONS,
  SETTINGS_KEY_LOCALE,
  SETTINGS_KEY_THEME,
  SETTINGS_THEME_MODES,
  type SettingsThemeMode,
} from './settings.constants';

/**
 * Persisted application settings storage.
 * Values are stored as JSONB rows keyed by a stable setting key;
 * reads merge stored values over built-in defaults.
 */
@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(AppSetting)
    private readonly appSettingModel: typeof AppSetting,
    @InjectModel(PermissionGroup)
    private readonly permissionGroupModel: typeof PermissionGroup,
    @InjectModel(Permission)
    private readonly permissionModel: typeof Permission,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getSettings(): Promise<AppSettingsSnapshot> {
    const rows = await this.appSettingModel.findAll();
    const storedByKey = new Map(rows.map((row) => [row.key, row.value]));

    return {
      defaultGroups:
        this.asStringArray(storedByKey.get(SETTINGS_KEY_DEFAULT_GROUPS)) ?? DEFAULT_APP_SETTINGS.defaultGroups,
      defaultPermissions:
        this.asStringArray(storedByKey.get(SETTINGS_KEY_DEFAULT_PERMISSIONS)) ??
        DEFAULT_APP_SETTINGS.defaultPermissions,
      theme: this.asTheme(storedByKey.get(SETTINGS_KEY_THEME)) ?? DEFAULT_APP_SETTINGS.theme,
      locale: this.asLocale(storedByKey.get(SETTINGS_KEY_LOCALE)) ?? DEFAULT_APP_SETTINGS.locale,
    };
  }

  /**
   * Returns default groups and permissions for newly created users.
   * Used by the users module; invalid ids are filtered out defensively.
   */
  async getDefaultAssignments(): Promise<{
    defaultGroups: string[];
    defaultPermissions: string[];
  }> {
    const settings = await this.getSettings();
    return {
      defaultGroups: settings.defaultGroups,
      defaultPermissions: settings.defaultPermissions,
    };
  }

  async updateSettings(dto: UpdateSettingsDto): Promise<AppSettingsSnapshot> {
    if (dto.defaultGroups) {
      await this.assertGroupsExist(dto.defaultGroups);
    }
    if (dto.defaultPermissions) {
      await this.assertPermissionsExist(dto.defaultPermissions);
    }

    const updates: Array<{ key: string; value: unknown }> = [];
    if (dto.defaultGroups) {
      updates.push({ key: SETTINGS_KEY_DEFAULT_GROUPS, value: dto.defaultGroups });
    }
    if (dto.defaultPermissions) {
      updates.push({
        key: SETTINGS_KEY_DEFAULT_PERMISSIONS,
        value: dto.defaultPermissions,
      });
    }
    if (dto.theme) {
      updates.push({ key: SETTINGS_KEY_THEME, value: dto.theme });
    }
    if (dto.locale) {
      updates.push({ key: SETTINGS_KEY_LOCALE, value: dto.locale });
    }

    for (const update of updates) {
      await this.upsertSetting(update.key, update.value);
    }

    const settings = await this.getSettings();

    this.eventEmitter.emit('settings.updated', new SettingsUpdatedEvent(settings));

    return settings;
  }

  private async upsertSetting(key: string, value: unknown): Promise<void> {
    const existing = await this.appSettingModel.findOne({ where: { key } });

    if (existing) {
      await existing.update({ value });
      return;
    }

    await this.appSettingModel.create({ key, value });
  }

  private async assertGroupsExist(groupIds: string[]): Promise<void> {
    const groups = await this.permissionGroupModel.findAll({
      where: { id: groupIds },
      paranoid: false,
    });

    if (groups.length !== new Set(groupIds).size) {
      throw new DomainException(
        'settings.ERRORS.SETTINGS_GROUP_NOT_FOUND',
        'One or more default groups do not exist',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private async assertPermissionsExist(permissionIds: string[]): Promise<void> {
    const permissions = await this.permissionModel.findAll({
      where: { id: permissionIds },
      paranoid: false,
    });

    if (permissions.length !== new Set(permissionIds).size) {
      throw new DomainException(
        'settings.ERRORS.SETTINGS_PERMISSION_NOT_FOUND',
        'One or more default permissions do not exist',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }
  }

  private asStringArray(value: unknown): string[] | null {
    if (!Array.isArray(value)) {
      return null;
    }

    const strings = value.filter((item): item is string => typeof item === 'string');
    return strings.length === value.length ? strings : null;
  }

  private asTheme(value: unknown): AppSettingsSnapshot['theme'] | null {
    return SETTINGS_THEME_MODES.includes(value as SettingsThemeMode) ? (value as SettingsThemeMode) : null;
  }

  private asLocale(value: unknown): AppSettingsSnapshot['locale'] | null {
    return value === 'ru' || value === 'en' ? value : null;
  }
}
