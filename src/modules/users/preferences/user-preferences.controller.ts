import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { UpdateUserPreferencesDto, UserPreferencesResponseDto } from './dto/user-preferences.dto';
import { UserPreferencesService } from './user-preferences.service';

const PREFERENCES_EXAMPLE: UserPreferencesResponseDto = {
  units: 'metric',
  weekStart: 'mon',
  timeFormat: '24h',
  coachEnabled: true,
  coachAdaptationMode: 'confirm',
  coachQuietHours: { from: '22:00', to: '08:00' },
  stravaProfileSync: true,
  timezone: 'Europe/Moscow',
  language: 'ru',
  updatedAt: new Date('2026-10-09T08:00:00.000Z'),
};

@ApiTags('Preferences')
@ApiBearerAuth()
@Controller({ path: 'me/preferences', version: '1' })
export class UserPreferencesController {
  constructor(private readonly preferencesService: UserPreferencesService) {}

  @Get()
  @RequirePermissions('account.preferences.read')
  @ApiOperation({ summary: 'Get the current user preferences (units, week start, AI coach)' })
  @ApiOkResponse({ type: UserPreferencesResponseDto, schema: { example: PREFERENCES_EXAMPLE } })
  get(@CurrentUser() user: AuthUserContext): Promise<UserPreferencesResponseDto> {
    return this.preferencesService.get(user.id);
  }

  @Patch()
  @RequirePermissions('account.preferences.update')
  @ApiOperation({ summary: 'Partially update the current user preferences' })
  @ApiOkResponse({ type: UserPreferencesResponseDto, schema: { example: PREFERENCES_EXAMPLE } })
  update(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponseDto> {
    return this.preferencesService.update(user.id, dto);
  }
}
