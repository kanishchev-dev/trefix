import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Param, Patch, Post, Query, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';

import { AuthService } from './auth.service';
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
import { UpdateUserDto } from '@/modules/users/dto/update-user.dto';
import { AuthSocialProvider } from './interfaces/auth-social-provider.interface';
import { AuthTokenResult } from './interfaces/auth-token-result.interface';
import { AuthUserContext } from './interfaces/auth-user-context.interface';
import { User } from '@/modules/users/entities/user.entity';

@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

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
  login(@Body() dto: LoginDto, @Req() request: Request, @Ip() ipAddress: string): Promise<AuthTokensResponseDto> {
    const userAgentHeader = request.headers['user-agent'];
    const userAgent = Array.isArray(userAgentHeader) ? userAgentHeader[0] : userAgentHeader;

    return this.toTokensResponse(this.authService.login(dto, { userAgent, ipAddress }));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh the access token' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authService.refresh(dto));
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/verify')
  @ApiOperation({ summary: 'Verify email address with a one-time code' })
  @ApiResponse({ status: 200, type: AuthVerificationResponseDto })
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<AuthVerificationResponseDto> {
    return this.authService.verifyEmail(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/otp/request')
  @ApiOperation({ summary: 'Request an email OTP code' })
  @ApiResponse({ status: 200, type: EmailOtpChallengeResponseDto })
  requestEmailOtpCode(@Body() dto: EmailOtpRequestDto): Promise<EmailOtpChallengeResponseDto> {
    return this.authService.requestEmailOtpCode(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/otp/verify')
  @ApiOperation({ summary: 'Verify the email OTP code' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  verifyEmailOtpCode(@Body() dto: EmailOtpVerifyDto): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authService.verifyEmailOtpCode(dto));
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Get('social/:provider/start')
  @ApiOperation({ summary: 'Start a social login flow' })
  async startSocialLogin(
    @Param('provider') provider: AuthSocialProvider,
    @Query('redirectUri') redirectUri: string,
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const callbackBaseUrl = `${request.protocol}://${request.get('host')}`;
    const startUrl = await this.authService.buildSocialStartUrl(provider, redirectUri, callbackBaseUrl);
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
    @Req() request: Request,
    @Res() response: Response,
  ): Promise<void> {
    const code = queryCode ?? body?.code;
    const state = queryState ?? body?.state;
    if (!code || !state) {
      response.status(HttpStatus.BAD_REQUEST).json({
        message: 'Missing authorization data',
        code: 'AUTH_SOCIAL_FLOW_INVALID',
      });
      return;
    }

    const callbackBaseUrl = `${request.protocol}://${request.get('host')}`;
    const redirectUri = await this.authService.completeSocialCallback(provider, code, state, callbackBaseUrl);
    response.redirect(302, redirectUri);
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('social/exchange')
  @ApiOperation({ summary: 'Exchange a social handoff code for tokens' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  exchangeSocialCode(@Body() dto: SocialExchangeDto): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authService.exchangeSocialCode(dto));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('social/apple/native')
  @ApiOperation({ summary: 'Exchange a native Apple sign-in authorization code for tokens' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  exchangeNativeAppleCode(@Body() dto: AppleNativeExchangeDto): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authService.exchangeNativeAppleCode(dto));
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('social/google/native')
  @ApiOperation({ summary: 'Exchange a native Google sign-in ID token for tokens' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  exchangeNativeGoogleCode(@Body() dto: GoogleNativeExchangeDto): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authService.exchangeNativeGoogleCode(dto));
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('email/resend')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Resend the email verification code' })
  @ApiNoContentResponse({ description: 'Verification code resent' })
  resendVerification(@Body() dto: ResendVerificationDto): Promise<void> {
    return this.authService.resendVerification(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('password/reset/request')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Request a password reset code' })
  @ApiNoContentResponse({ description: 'Password reset code requested' })
  requestPasswordReset(@Body() dto: PasswordResetRequestDto): Promise<void> {
    return this.authService.requestPasswordReset(dto);
  }

  @Public()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('password/reset/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Confirm password reset with code' })
  @ApiNoContentResponse({ description: 'Password reset completed' })
  confirmPasswordReset(@Body() dto: PasswordResetConfirmDto): Promise<void> {
    return this.authService.confirmPasswordReset(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current authenticated user' })
  @ApiResponse({ status: 200, type: AuthUserResponseDto })
  me(@CurrentUser() user: AuthUserContext): Promise<AuthUserResponseDto> {
    return this.authService.me(user);
  }

  @Patch('me')
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
    return this.authService.logout(user);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Log out all active sessions' })
  @ApiNoContentResponse({ description: 'All sessions revoked' })
  logoutAll(@CurrentUser() user: AuthUserContext): Promise<void> {
    return this.authService.logoutAll(user.id);
  }

  @Post('password/change')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change the current user password' })
  @ApiResponse({ status: 200, type: AuthTokensResponseDto })
  changePassword(@CurrentUser() user: AuthUserContext, @Body() dto: ChangePasswordDto): Promise<AuthTokensResponseDto> {
    return this.toTokensResponse(this.authService.changePassword(user, dto));
  }

  private async toTokensResponse(
    resultPromise: Promise<{ user: User; tokens: AuthTokenResult }>,
  ): Promise<AuthTokensResponseDto> {
    const result = await resultPromise;
    return {
      tokenType: 'Bearer',
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      sessionId: result.tokens.sessionId,
      accessTokenExpiresIn: result.tokens.accessTokenExpiresIn,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        avatarUrl: result.user.avatarUrl ?? undefined,
        referralCode: result.user.referralCode ?? undefined,
        emailVerified: result.user.emailVerified,
        createdAt: result.user.createdAt,
        features: {
          showReferral: !!result.user.referralCode,
        },
      },
    };
  }
}
