import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test, TestingModule } from '@nestjs/testing';

import { PermissionsService } from '@/modules/permissions/permissions.service';

import { AppSetting } from './entities/app-setting.entity';
import { DEFAULT_APP_SETTINGS, SETTINGS_KEY_DEFAULT_GROUPS, SETTINGS_KEY_THEME } from './settings.constants';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let appSettingModel: {
    findAll: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
  };
  let eventEmitter: EventEmitter2;

  beforeEach(async () => {
    appSettingModel = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((value) => Promise.resolve(value)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: getModelToken(AppSetting),
          useValue: appSettingModel,
        },
        {
          provide: PermissionsService,
          useValue: {
            findMissingGroupIds: jest.fn().mockResolvedValue([]),
            findMissingPermissionIds: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    eventEmitter = module.get<EventEmitter2>(EventEmitter2);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getSettings', () => {
    it('should fall back to built-in defaults when nothing is stored', async () => {
      const settings = await service.getSettings();
      expect(settings).toEqual(DEFAULT_APP_SETTINGS);
    });

    it('should merge stored values over defaults', async () => {
      appSettingModel.findAll.mockResolvedValue([
        { key: SETTINGS_KEY_THEME, value: 'dark' },
        { key: SETTINGS_KEY_DEFAULT_GROUPS, value: ['group-1'] },
      ]);

      const settings = await service.getSettings();

      expect(settings.theme).toBe('dark');
      expect(settings.defaultGroups).toEqual(['group-1']);
      expect(settings.locale).toBe(DEFAULT_APP_SETTINGS.locale);
    });

    it('should accept the system theme mode', async () => {
      appSettingModel.findAll.mockResolvedValue([{ key: SETTINGS_KEY_THEME, value: 'system' }]);

      const settings = await service.getSettings();

      expect(settings.theme).toBe('system');
    });

    it('should ignore malformed stored values', async () => {
      appSettingModel.findAll.mockResolvedValue([
        { key: SETTINGS_KEY_THEME, value: 'neon' },
        { key: SETTINGS_KEY_DEFAULT_GROUPS, value: 'not-an-array' },
      ]);

      const settings = await service.getSettings();

      expect(settings.theme).toBe(DEFAULT_APP_SETTINGS.theme);
      expect(settings.defaultGroups).toEqual([]);
    });
  });

  describe('updateSettings', () => {
    it('should persist values and emit an event', async () => {
      await service.updateSettings({ theme: 'dark', locale: 'ru' });

      expect(appSettingModel.create).toHaveBeenCalledWith({
        key: SETTINGS_KEY_THEME,
        value: 'dark',
      });
      expect(eventEmitter.emit).toHaveBeenCalledWith('settings.updated', expect.anything());
    });
  });
});
