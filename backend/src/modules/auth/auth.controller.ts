import { Body, Controller, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { ActivateInviteDto } from '@/modules/users/dto/activate-invite.dto';
import { UpdateUserDto } from '@/modules/users/dto/update-user.dto';
import { User } from '@/modules/users/entities/user.entity';

import { toAuthUserResponse } from './auth.helpers';
import { AuthService } from './auth.service';
import { ClientContext } from './decorators/client-context.decorator';
import { AppleNativeExchangeDto } from './dto/apple-native-exchange.dto';
import { AuthRegisterResponseDto } from './dto/auth-register-response.dto';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { AuthVerificationResponseDto } from './dto/auth-verification-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailOtpChallengeResponseDto } from './dto/email-otp-challenge-response.dto';
import { EmailOtpRequestDto } from './dto/email-otp-request.dto';
import { EmailOtpVerifyDto } from './dto/email-otp-verify.dto';
import { GoogleNativeExchangeDto } from './dto/google-native-exchange.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { SocialExchangeDto } from './dto/social-exchange.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthSocialFlowInvalidException } from './exceptions/auth-social-flow-invalid.exception';
import { AuthClientContext } from './interfaces/auth-client-context.interface';
import { AuthSocialProvider } from './interfaces/auth-social-provider.interface';
import { AuthTokenResult } from './interfaces/auth-token-result.interface';
import { AuthUserContext } from './interfaces/auth-user-context.interface';
import { AuthCodeService } from './services/auth-code.service';
import { AuthSessionService } from './services/auth-session.service';
import { AuthSocialFlowService } from './services/auth-social-flow.service';

@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authSessionService: AuthSessionService,
    private readonly authCodeService: AuthCodeService,
    private readonly authSocialFlowService: AuthSocialFlowService,
  ) {}

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, type: AuthRegisterResponseDto })
  register(@Body() dto: RegisterDto): Promise<AuthRegisterResponseDto> {
    return this.authService.register(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @ApiOperation({ summary: 'Log in with email and password' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  login(@Body() dto: LoginDto, @ClientContext() client: AuthClientContext): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authService.login(dto, client));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh the access token' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authSessionService.refresh(dto));
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/verify')
  @ApiOperation({ summary: 'Verify email address with a one-time code' })
  @ApiResponse({ status: 200, type: AuthVerificationResponseDto })
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<AuthVerificationResponseDto> {
    return this.authCodeService.verifyEmail(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/otp/request')
  @ApiOperation({ summary: 'Request an email OTP code' })
  @ApiResponse({ status: 200, type: EmailOtpChallengeResponseDto })
  requestEmailOtpCode(@Body() dto: EmailOtpRequestDto): Promise<EmailOtpChallengeResponseDto> {
    return this.authCodeService.requestEmailOtpCode(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/otp/verify')
  @ApiOperation({ summary: 'Verify the email OTP code' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  verifyEmailOtpCode(
    @Body() dto: EmailOtpVerifyDto,
    @ClientContext() client: AuthClientContext,
  ): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authCodeService.verifyEmailOtpCode(dto, client));
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Get('social/:provider/start')
  @ApiOperation({ summary: 'Start a social login flow' })
  async startSocialLogin(
    @Param('provider') provider: AuthSocialProvider,
    @Query('redirectUri') redirectUri: string,
    @Res() response: Response,
  ): Promise<void> {
    const startUrl = await this.authSocialFlowService.buildSocialStartUrl(provider, redirectUri);
    response.redirect(302, startUrl);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Get('social/:provider/callback')
  @Post('social/:provider/callback')
  @ApiOperation({ summary: 'Handle a social login callback' })
  async handleSocialCallback(
    @Param('provider') provider: AuthSocialProvider,
    @Query('code') queryCode: string | undefined,
    @Query('state') queryState: string | undefined,
    @Body() body: { code?: string; state?: string } | undefined,
    @ClientContext() client: AuthClientContext,
    @Res() response: Response,
  ): Promise<void> {
    const code = queryCode ?? body?.code;
    const state = queryState ?? body?.state;
    if (!code || !state) {
      throw new AuthSocialFlowInvalidException('Missing authorization data');
    }

    const redirectUri = await this.authSocialFlowService.completeSocialCallback(provider, code, state, client);
    response.redirect(302, redirectUri);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('social/exchange')
  @ApiOperation({ summary: 'Exchange a social handoff code for tokens' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  exchangeSocialCode(@Body() dto: SocialExchangeDto): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authSocialFlowService.exchangeSocialCode(dto));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('social/apple/native')
  @ApiOperation({ summary: 'Exchange a native Apple sign-in authorization code for tokens' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  exchangeNativeAppleCode(
    @Body() dto: AppleNativeExchangeDto,
    @ClientContext() client: AuthClientContext,
  ): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authSocialFlowService.exchangeNativeAppleCode(dto, client));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('social/google/native')
  @ApiOperation({ summary: 'Exchange a native Google sign-in ID token for tokens' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  exchangeNativeGoogleCode(
    @Body() dto: GoogleNativeExchangeDto,
    @ClientContext() client: AuthClientContext,
  ): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authSocialFlowService.exchangeNativeGoogleCode(dto, client));
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resend the email verification code' })
  @ApiNoContentResponse({ description: 'Verification code resent' })
  resendVerification(@Body() dto: ResendVerificationDto): Promise<void> {
    return this.authCodeService.resendVerification(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('password/reset/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request a password reset code' })
  @ApiNoContentResponse({ description: 'Password reset code requested' })
  requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<void> {
    return this.authCodeService.requestPasswordReset(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('password/reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm password reset with code' })
  @ApiNoContentResponse({ description: 'Password reset completed' })
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto): Promise<void> {
    return this.authCodeService.confirmPasswordReset(dto);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('invite/activate')
  @ApiOperation({ summary: 'Activate an invited account by setting a password' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  activateInvite(
    @Body() dto: ActivateInviteDto,
    @ClientContext() client: AuthClientContext,
  ): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authService.activateInvite(dto, client));
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiResponse({ status: 200, type: AuthUserResponseDto })
  me(@CurrentUser() user: AuthUserContext): Promise<AuthUserResponseDto> {
    return this.authService.me(user);
  }

  /**
   * Self-service profile edits. Gated with `account.update` rather than
   * `users.update`, because editing your own profile is not an admin
   * capability — the permission is granted to every account by default and can
   * still be revoked to lock a service account down. The remaining session
   * endpoints (logout, password change) stay ungated: they are inseparable
   * from holding a session at all.
   */
  @Patch('me')
  @RequirePermissions('account.update')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update the current authenticated user' })
  @ApiResponse({ status: 200, type: AuthUserResponseDto })
  updateMe(@CurrentUser() user: AuthUserContext, @Body() dto: UpdateUserDto): Promise<AuthUserResponseDto> {
    return this.authService.updateMe(user, dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out the current session' })
  @ApiNoContentResponse({ description: 'Current session revoked' })
  logout(@CurrentUser() user: AuthUserContext): Promise<void> {
    return this.authSessionService.logout(user);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out all active sessions' })
  @ApiNoContentResponse({ description: 'All sessions revoked' })
  logoutAll(@CurrentUser() user: AuthUserContext): Promise<void> {
    return this.authSessionService.logoutAll(user.id);
  }

  @Post('password/change')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current user password' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  changePassword(
    @CurrentUser() user: AuthUserContext,
    @Body() dto: ChangePasswordDto,
    @ClientContext() client: AuthClientContext,
  ): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authService.changePassword(user, dto, client));
  }

  private async toTokensResponse(
    resultPromise: Promise<{ user: User; tokens: AuthTokenResult; permissions: string[] }>,
  ): Promise<AuthTokensResponseDto> {
    const result = await resultPromise;
    return {
      tokenType: 'Bearer',
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      sessionId: result.tokens.sessionId,
      accessTokenExpiresIn: result.tokens.accessTokenExpiresIn,
      user: toAuthUserResponse(result.user, result.permissions),
    };
  }
}
