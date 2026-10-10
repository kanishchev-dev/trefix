import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { ConsentResponseDto, ConsentsListResponseDto, GiveConsentDto, RevokeConsentParamsDto } from './dto/consent.dto';
import { UserConsentsService } from './user-consents.service';

@ApiTags('Consents')
@ApiBearerAuth()
@Controller({ path: 'me/consents', version: '1' })
export class UserConsentsController {
  constructor(private readonly consentsService: UserConsentsService) {}

  @Get()
  @RequirePermissions('account.preferences.read')
  @ApiOperation({ summary: 'Consents of the current user and the current text versions' })
  @ApiOkResponse({ type: ConsentsListResponseDto })
  list(@CurrentUser() user: AuthUserContext): Promise<ConsentsListResponseDto> {
    return this.consentsService.list(user.id);
  }

  @Post()
  @RequirePermissions('account.update')
  @ApiOperation({ summary: 'Accept a consent text version (health data processing)' })
  @ApiCreatedResponse({ type: ConsentResponseDto })
  give(@CurrentUser() user: AuthUserContext, @Body() dto: GiveConsentDto): Promise<ConsentResponseDto> {
    return this.consentsService.give(user.id, dto);
  }

  @Delete(':type')
  @RequirePermissions('account.update')
  @ApiOperation({ summary: 'Revoke a consent; revoking health data disconnects Apple Health and Health Connect' })
  @ApiOkResponse({ schema: { example: { success: true } } })
  revoke(@CurrentUser() user: AuthUserContext, @Param() params: RevokeConsentParamsDto): Promise<{ success: true }> {
    return this.consentsService.revoke(user.id, params.type);
  }
}
