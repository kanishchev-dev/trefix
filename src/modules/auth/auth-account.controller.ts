import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';

import { AppleNativeExchangeDto } from './dto/apple-native-exchange.dto';
import { AuthIdentityListResponseDto, AuthIdentityResponseDto } from './dto/auth-identity.dto';
import { AuthSessionListResponseDto } from './dto/auth-session-response.dto';
import { EmailChangeChallengeResponseDto, EmailChangeConfirmDto, EmailChangeRequestDto } from './dto/email-change.dto';
import { GoogleNativeExchangeDto } from './dto/google-native-exchange.dto';
import type { AuthSocialProvider } from './interfaces/auth-social-provider.interface';
import { AuthUserContext } from './interfaces/auth-user-context.interface';
import { SocialProviderParamPipe } from './pipes/social-provider-param.pipe';
import { AuthEmailChangeService } from './services/auth-email-change.service';
import { AuthSessionService } from './services/auth-session.service';
import { AuthSocialFlowService } from './services/auth-social-flow.service';
import { UserIdentityService } from './services/user-identity.service';

/** Account and security screen: devices (sessions), sign-in methods and the account email. */
@ApiTags('Auth')
@ApiBearerAuth()
@Controller({ path: 'auth', version: '1' })
export class AuthAccountController {
  constructor(
    private readonly authSessionService: AuthSessionService,
    private readonly userIdentityService: UserIdentityService,
    private readonly authSocialFlowService: AuthSocialFlowService,
    private readonly authEmailChangeService: AuthEmailChangeService,
  ) {}

  @Get('sessions')
  @ApiOperation({ summary: 'Devices signed in to the account' })
  @ApiResponse({ status: 200, type: AuthSessionListResponseDto })
  async listSessions(@CurrentUser() user: AuthUserContext): Promise<AuthSessionListResponseDto> {
    return { items: await this.authSessionService.listSessions(user) };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Sign out another device',
    description: 'Errors: AUTH_SESSION_NOT_FOUND, AUTH_SESSION_CURRENT',
  })
  @ApiNoContentResponse()
  revokeSession(@CurrentUser() user: AuthUserContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.authSessionService.revokeSession(user, id);
  }

  @Post('logout-others')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Sign out every device except this one' })
  @ApiNoContentResponse()
  logoutOthers(@CurrentUser() user: AuthUserContext): Promise<void> {
    return this.authSessionService.logoutOthers(user);
  }

  @Get('identities')
  @ApiOperation({ summary: 'Apple and Google accounts linked for sign-in' })
  @ApiResponse({ status: 200, type: AuthIdentityListResponseDto })
  async listIdentities(@CurrentUser() user: AuthUserContext): Promise<AuthIdentityListResponseDto> {
    return { items: await this.userIdentityService.list(user.id) };
  }

  @Post('identities/apple')
  @RequirePermissions('account.update')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Link an Apple account with a native authorization code',
    description: 'Errors: AUTH_IDENTITY_IN_USE, AUTH_IDENTITY_ALREADY_LINKED',
  })
  @ApiResponse({ status: 201, type: AuthIdentityResponseDto })
  linkApple(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: AppleNativeExchangeDto,
  ): Promise<AuthIdentityResponseDto> {
    return this.authSocialFlowService.linkNativeIdentity(user.id, 'apple', dto.authorizationCode);
  }

  @Post('identities/google')
  @RequirePermissions('account.update')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Link a Google account with a native ID token',
    description: 'Errors: AUTH_IDENTITY_IN_USE, AUTH_IDENTITY_ALREADY_LINKED',
  })
  @ApiResponse({ status: 201, type: AuthIdentityResponseDto })
  linkGoogle(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: GoogleNativeExchangeDto,
  ): Promise<AuthIdentityResponseDto> {
    return this.authSocialFlowService.linkNativeIdentity(user.id, 'google', dto.idToken);
  }

  @Delete('identities/:provider')
  @RequirePermissions('account.update')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'provider', enum: ['apple', 'google'] })
  @ApiOperation({ summary: 'Unlink an Apple or Google account', description: 'Errors: AUTH_IDENTITY_NOT_FOUND' })
  @ApiNoContentResponse()
  unlink(
    @CurrentUser() user: AuthUserContext,
    @Param('provider', SocialProviderParamPipe) provider: AuthSocialProvider,
  ): Promise<void> {
    return this.userIdentityService.unlink(user.id, provider);
  }

  @Post('email/change/request')
  @RequirePermissions('account.update')
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Send a code to the new email',
    description: 'Errors: AUTH_EMAIL_UNCHANGED, AUTH_EMAIL_ALREADY_EXISTS, AUTH_VERIFICATION_CODE_RATE_LIMITED',
  })
  @ApiResponse({ status: 200, type: EmailChangeChallengeResponseDto })
  requestEmailChange(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: EmailChangeRequestDto,
  ): Promise<EmailChangeChallengeResponseDto> {
    return this.authEmailChangeService.request(user, dto.email);
  }

  @Post('email/change/confirm')
  @RequirePermissions('account.update')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Confirm the new email with the code',
    description: 'Errors: AUTH_VERIFICATION_CODE_INVALID',
  })
  @ApiNoContentResponse()
  confirmEmailChange(@CurrentUser() user: AuthUserContext, @Body() dto: EmailChangeConfirmDto): Promise<void> {
    return this.authEmailChangeService.confirm(user, dto.code);
  }
}
