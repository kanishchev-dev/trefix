import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';

import { AdminEmailChangeDto } from './dto/admin-email-change.dto';
import { AuthIdentityListResponseDto } from './dto/auth-identity.dto';
import { AuthSessionListResponseDto } from './dto/auth-session-response.dto';
import type { AuthSocialProvider } from './interfaces/auth-social-provider.interface';
import { SocialProviderParamPipe } from './pipes/social-provider-param.pipe';
import { AdminAuthService } from './services/admin-auth.service';

/** Sessions, sign-in methods, email and password of any user, for the admin panel. */
@ApiTags('Admin Account Security')
@ApiBearerAuth()
@AdminEndpoint()
@ApiParam({ name: 'userId', format: 'uuid' })
@Controller({ path: 'users/:userId', version: '1' })
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  @Get('sessions')
  @RequirePermissions('users.security.read')
  @ApiOperation({ summary: 'Active sessions (devices) of the user' })
  @ApiOkResponse({ type: AuthSessionListResponseDto })
  async listSessions(@Param('userId', ParseUUIDPipe) userId: string): Promise<AuthSessionListResponseDto> {
    return { items: await this.adminAuthService.listSessions(userId) };
  }

  @Delete('sessions/:sessionId')
  @RequirePermissions('users.security.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End one session of the user' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'AUTH_SESSION_NOT_FOUND' })
  revokeSession(@Param('userId', ParseUUIDPipe) userId: string, @Param('sessionId') sessionId: string): Promise<void> {
    return this.adminAuthService.revokeSession(userId, sessionId);
  }

  @Post('sessions/revoke-all')
  @RequirePermissions('users.security.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'End every session of the user' })
  @ApiNoContentResponse()
  revokeAllSessions(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.adminAuthService.revokeAllSessions(userId);
  }

  @Get('identities')
  @RequirePermissions('users.security.read')
  @ApiOperation({ summary: 'Apple and Google accounts linked for sign-in' })
  @ApiOkResponse({ type: AuthIdentityListResponseDto })
  async listIdentities(@Param('userId', ParseUUIDPipe) userId: string): Promise<AuthIdentityListResponseDto> {
    return { items: await this.adminAuthService.listIdentities(userId) };
  }

  @Delete('identities/:provider')
  @RequirePermissions('users.security.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Unlink an Apple or Google account; email codes keep working' })
  @ApiParam({ name: 'provider', enum: ['apple', 'google'] })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ description: 'AUTH_IDENTITY_NOT_FOUND' })
  unlinkIdentity(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('provider', SocialProviderParamPipe) provider: AuthSocialProvider,
  ): Promise<void> {
    return this.adminAuthService.unlinkIdentity(userId, provider);
  }

  @Post('password-reset')
  @RequirePermissions('users.security.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Email the user a password reset code' })
  @ApiNoContentResponse()
  sendPasswordReset(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.adminAuthService.sendPasswordReset(userId);
  }

  @Post('email/verify')
  @RequirePermissions('users.security.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark the email as verified' })
  @ApiNoContentResponse()
  verifyEmail(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.adminAuthService.verifyEmail(userId);
  }

  @Patch('email')
  @RequirePermissions('users.security.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Change the email; the new address stays unverified until the user enters the code' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'EMAIL_TAKEN' })
  changeEmail(@Param('userId', ParseUUIDPipe) userId: string, @Body() dto: AdminEmailChangeDto): Promise<void> {
    return this.adminAuthService.changeEmail(userId, dto.email);
  }
}
