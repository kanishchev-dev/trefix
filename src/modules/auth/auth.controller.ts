import { Body, Controller, Get, HttpCode, HttpStatus, Ip, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';

import { AuthService } from './auth.service';
import { AuthRegisterResponseDto } from './dto/auth-register-response.dto';
import { AuthTokensResponseDto } from './dto/auth-tokens-response.dto';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { AuthVerificationResponseDto } from './dto/auth-verification-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RegisterDto } from './dto/register.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthTokenResult } from './interfaces/auth-token-result.interface';
import { AuthUserContext } from './interfaces/auth-user-context.interface';

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
    resultPromise: Promise<{ user: AuthUserContext; tokens: AuthTokenResult }>,
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
        emailVerified: result.user.emailVerified,
      },
    };
  }
}
