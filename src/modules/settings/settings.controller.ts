import { Body, Controller, ForbiddenException, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';
import { PermissionsService } from '@/modules/permissions/permissions.service';

import { SettingsResponseDto } from './dto/settings-response.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { AppSettingsSnapshot } from './settings.constants';
import { SettingsService } from './settings.service';

@ApiTags('Settings')
@ApiBearerAuth()
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @Get()
  @RequirePermissions('settings.read')
  @ApiOperation({ summary: 'Get global application settings' })
  @ApiResponse({ status: 200, type: SettingsResponseDto })
  getSettings(): Promise<AppSettingsSnapshot> {
    return this.settingsService.getSettings();
  }

  /**
   * Updates global settings.
   *
   * Appearance preferences (theme, locale) are available to every
   * authenticated user because every admin can switch them from the sidebar
   * dropdown. Defaults for new users are an access-control concern and
   * therefore require the `permissions.manage` permission.
   */
  @Patch()
  @RequirePermissions('settings.update')
  @ApiOperation({ summary: 'Update global application settings' })
  @ApiResponse({ status: 200, type: SettingsResponseDto })
  async updateSettings(
    @Body() dto: UpdateSettingsDto,
    @CurrentUser() user: AuthUserContext,
  ): Promise<AppSettingsSnapshot> {
    const touchesDefaults = dto.defaultGroups !== undefined || dto.defaultPermissions !== undefined;

    if (touchesDefaults) {
      const permissions = await this.permissionsService.getEffectivePermissions(user.id);
      if (!permissions.includes('permissions.manage')) {
        throw new ForbiddenException({
          statusCode: 403,
          code: 'SETTINGS_PERMISSION_DENIED',
          message: 'Changing default groups or permissions requires the permissions.manage permission.',
        });
      }
    }

    return this.settingsService.updateSettings(dto);
  }
}
