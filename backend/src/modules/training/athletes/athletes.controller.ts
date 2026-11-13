import { Body, Controller, Get, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { ATHLETE_PROFILE_EXAMPLE } from '../training.openapi';
import { AthleteProfileService } from './athlete-profile.service';
import { AthleteProfileResponseDto } from './dto/athlete-profile-response.dto';
import { UpdateAthleteProfileDto } from './dto/update-athlete-profile.dto';

/** The own athlete profile. Registered before `TrainingController` so `athletes/me` wins over `athletes/:id`. */
@ApiTags('Training')
@ApiBearerAuth()
@Controller({ path: 'athletes/me', version: '1' })
export class AthletesController {
  constructor(private readonly profileService: AthleteProfileService) {}

  @Get()
  @RequirePermissions('training.athletes.read')
  @ApiOperation({ summary: 'Get the current user athlete profile with derived zones and completeness' })
  @ApiOkResponse({ type: AthleteProfileResponseDto, schema: { example: ATHLETE_PROFILE_EXAMPLE } })
  getMe(@CurrentUser() user: AuthUserContext): Promise<AthleteProfileResponseDto> {
    return this.profileService.getMyProfile(user.id);
  }

  @Patch()
  @RequirePermissions('training.athletes.update')
  @ApiOperation({
    summary: 'Partially update the current user athlete profile',
    description:
      'Errors: ATHLETE_FIELD_OUT_OF_RANGE (details.fields[{ field, min, max }]), ' +
      'ATHLETE_HEART_RATE_INCONSISTENT, ATHLETE_ZONES_INVALID. Edited fields become `manual` in fieldSources.',
  })
  @ApiOkResponse({ type: AthleteProfileResponseDto, schema: { example: ATHLETE_PROFILE_EXAMPLE } })
  updateMe(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: UpdateAthleteProfileDto,
  ): Promise<AthleteProfileResponseDto> {
    return this.profileService.updateMyProfile(user.id, dto);
  }
}
