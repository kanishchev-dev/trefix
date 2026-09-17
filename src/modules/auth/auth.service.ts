import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { createHash, randomInt, randomUUID } from 'crypto';
import * as jwt from 'jsonwebtoken';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { comparePassword, hashPassword } from '@/common/utils/password-hash.util';
import { MailerService } from '@/modules/mailer/mailer.service';
import { PermissionsService } from '@/modules/permissions/permissions.service';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import {
  AUTH_DEFAULT_DISPLAY_NAME,
  AUTH_EMAIL_OTP_TEMPLATE,
  AUTH_EMAIL_VERIFICATION_CODE_LENGTH,
  AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS,
  AUTH_EMAIL_VERIFICATION_TEMPLATE,
  AUTH_PASSWORD_HASH_ROUNDS,
  AUTH_PASSWORD_RESET_CODE_LENGTH,
  AUTH_PASSWORD_RESET_MAX_ATTEMPTS,
  AUTH_PASSWORD_RESET_TEMPLATE,
} from './auth.constants';
import { AppleNativeExchangeDto } from './dto/apple-native-exchange.dto';
import { AuthRegisterResponseDto } from './dto/auth-register-response.dto';
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
import { AuthEmailOtpRequestedEvent } from './events/auth-email-otp-requested.event';
import { AuthEmailVerifiedEvent } from './events/auth-email-verified.event';
import { AuthPasswordChangedEvent } from './events/auth-password-changed.event';
import { AuthPasswordResetRequestedEvent } from './events/auth-password-reset-requested.event';
import { AuthRegisteredEvent } from './events/auth-registered.event';
import { AuthSessionCreatedEvent } from './events/auth-session-created.event';
import { AuthSessionRevokedEvent } from './events/auth-session-revoked.event';
import { AuthEmailAlreadyExistsException } from './exceptions/auth-email-already-exists.exception';
import { AuthEmailNotVerifiedException } from './exceptions/auth-email-not-verified.exception';
import { AuthInvalidCredentialsException } from './exceptions/auth-invalid-credentials.exception';
import { AuthPasswordResetCodeInvalidException } from './exceptions/auth-password-reset-code-invalid.exception';
import { AuthPasswordResetTokenExpiredException } from './exceptions/auth-password-reset-token-expired.exception';
import { AuthRefreshTokenReuseException } from './exceptions/auth-refresh-token-reuse.exception';
import { AuthSessionNotFoundException } from './exceptions/auth-session-not-found.exception';
import { AuthSocialFlowInvalidException } from './exceptions/auth-social-flow-invalid.exception';
import { AuthSocialProviderUnavailableException } from './exceptions/auth-social-provider-unavailable.exception';
import { AuthTokenInvalidException } from './exceptions/auth-token-invalid.exception';
import { AuthVerificationCodeInvalidException } from './exceptions/auth-verification-code-invalid.exception';
import { AuthVerificationCodeRateLimitException } from './exceptions/auth-verification-code-rate-limit.exception';
import { AuthCodeRecord } from './interfaces/auth-code-record.interface';
import { AuthEmailOtpCodeRecord } from './interfaces/auth-email-otp-code-record.interface';
import { AuthSessionRecord } from './interfaces/auth-session.interface';
import { AuthSocialProvider } from './interfaces/auth-social-provider.interface';
import { AuthTokenResult } from './interfaces/auth-token-result.interface';
import { AuthUserContext } from './interfaces/auth-user-context.interface';
import { AuthRedisService } from './services/auth-redis.service';
import { AuthTokenService } from './services/auth-token.service';
import { parseDurationToMilliseconds } from './utils/duration.util';

interface AuthenticatedUserResult {
  user: AuthUserContext;
  tokens: AuthTokenResult;
}

interface SocialProfile {
  email: string;
  firstName: string;
  lastName: string;
  providerSubject: string;
}

interface SocialTokenResponse {
  access_token?: string;
  expires_in?: number;
  id_token?: string;
  refresh_token?: string;
  token_type?: string;
}

interface GoogleUserInfoResponse {
  email?: string;
  email_verified?: boolean;
  family_name?: string;
  given_name?: string;
  name?: string;
  sub?: string;
}

interface GoogleIdTokenPayload {
  email?: string;
  email_verified?: boolean | string;
  family_name?: string;
  given_name?: string;
  name?: string;
  sub?: string;
}

interface AppleIdTokenPayload {
  email?: string;
  email_verified?: boolean | string;
  family_name?: string;
  given_name?: string;
  is_private_email?: boolean | string;
  name?: string;
  sub?: string;
}

interface GoogleCertsResponse {
  [key: string]: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly authRedisService: AuthRedisService,
    private readonly authTokenService: AuthTokenService,
    private readonly mailerService: MailerService,
    private readonly permissionsService: PermissionsService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async register(dto: RegisterDto): Promise<AuthRegisterResponseDto> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new AuthEmailAlreadyExistsException();
    }

    const passwordHash = await this.hashPassword(dto.password);
    const { firstName, lastName } = this.resolveRegistrationName(dto.email, dto.firstName, dto.lastName);

    const user = await this.usersService.create({
      email: dto.email,
      firstName,
      lastName,
      passwordHash,
      emailVerified: false,
    });

    await this.issueVerificationCode(user);
    this.eventEmitter.emit('auth.registered', new AuthRegisteredEvent(user.id, user.email));

    return {
      user: this.toAuthUserResponse(user),
      emailVerificationRequired: true,
    };
  }

  async requestEmailOtpCode(dto: EmailOtpRequestDto): Promise<EmailOtpChallengeResponseDto> {
    const email = this.normalizeEmail(dto.email);
    if (await this.authRedisService.isEmailOtpCooldownActive(email)) {
      throw new AuthVerificationCodeRateLimitException();
    }

    const code = this.generateNumericCode(AUTH_EMAIL_VERIFICATION_CODE_LENGTH);
    const ttlMilliseconds = this.getEmailVerificationTtlMilliseconds();
    const record: AuthEmailOtpCodeRecord = {
      ...this.buildCodeRecord(code, ttlMilliseconds),
      email,
    };

    await this.authRedisService.setEmailOtpCode(
      email,
      record,
      ttlMilliseconds,
      this.getVerificationCooldownMilliseconds(),
    );

    await this.mailerService.send({
      to: email,
      subject: 'Your sign-in code',
      template: AUTH_EMAIL_OTP_TEMPLATE,
      data: {
        code,
        expiresIn: Math.max(1, Math.ceil(ttlMilliseconds / 60000)),
      },
    });

    this.eventEmitter.emit(
      'auth.email_otp_requested',
      new AuthEmailOtpRequestedEvent(email, Math.max(1, Math.ceil(ttlMilliseconds / 1000))),
    );

    return {
      email,
      expiresInSeconds: Math.max(1, Math.ceil(ttlMilliseconds / 1000)),
      resendAfterSeconds: Math.max(1, Math.ceil(this.getVerificationCooldownMilliseconds() / 1000)),
    };
  }

  async verifyEmailOtpCode(dto: EmailOtpVerifyDto): Promise<AuthenticatedUserResult> {
    const email = this.normalizeEmail(dto.email);
    const record = await this.authRedisService.getEmailOtpCode(email);

    const isValid = await this.verifyCodeRecord(
      record,
      dto.code,
      () => this.authRedisService.incrementEmailOtpAttempts(email, AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS),
      () => this.authRedisService.clearEmailOtpCode(email),
    );

    if (!isValid) {
      throw new AuthVerificationCodeInvalidException();
    }

    const user = await this.resolveOrCreateEmailOtpUser(email);
    if (!user.emailVerified) {
      await this.usersService.setEmailVerified(user.id, true);
    }

    const currentUser = await this.usersService.findOne(user.id);
    this.eventEmitter.emit('auth.email_verified', new AuthEmailVerifiedEvent(currentUser.id, currentUser.email));

    return this.createAuthenticatedSession(currentUser, {
      userAgent: undefined,
      ipAddress: undefined,
    });
  }

  async login(
    dto: LoginDto,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthenticatedUserResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new AuthInvalidCredentialsException();
    }

    const passwordMatches = await this.verifyPassword(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AuthInvalidCredentialsException();
    }

    if (!user.emailVerified) {
      throw new AuthEmailNotVerifiedException();
    }

    return this.createAuthenticatedSession(user, context);
  }

  async refresh(dto: RefreshTokenDto): Promise<AuthenticatedUserResult> {
    let payload: Awaited<ReturnType<AuthTokenService['verifyRefreshToken']>>;
    try {
      payload = await this.authTokenService.verifyRefreshToken(dto.refreshToken);
    } catch {
      throw new AuthTokenInvalidException();
    }

    if (payload.tokenType !== 'refresh') {
      throw new AuthTokenInvalidException();
    }

    const session = await this.authRedisService.getSession(payload.sessionId);
    if (!session || session.userId !== payload.sub) {
      throw new AuthSessionNotFoundException();
    }

    const tokenHash = this.hashSecret(dto.refreshToken);
    const nextRefreshToken = await this.authTokenService.signRefreshToken(session.userId, session.sessionId);
    const nextRefreshTokenHash = this.hashSecret(nextRefreshToken);
    const ttlMilliseconds = this.getRefreshTokenTtlMilliseconds();

    const rotation = await this.authRedisService.rotateSession(
      session.sessionId,
      session.userId,
      tokenHash,
      nextRefreshTokenHash,
      ttlMilliseconds,
    );

    if (rotation.status === 'missing') {
      throw new AuthSessionNotFoundException();
    }

    if (rotation.status === 'reused') {
      const revokedSessions = await this.authRedisService.revokeUserSessions(session.userId);
      this.emitSessionRevokedEvents(
        [...(rotation.session ? [rotation.session] : []), ...revokedSessions],
        'refresh-reuse',
      );
      throw new AuthRefreshTokenReuseException();
    }

    let user: User;
    try {
      user = await this.usersService.findOne(session.userId);
    } catch (error) {
      if (error instanceof EntityNotFoundException) {
        await this.authRedisService.revokeSession(session.sessionId);
        throw new AuthSessionNotFoundException();
      }

      throw error;
    }

    const accessToken = await this.authTokenService.signAccessToken(user.id, session.sessionId);

    return {
      user: this.toAuthUserContext(user, session.sessionId),
      tokens: {
        accessToken,
        refreshToken: nextRefreshToken,
        sessionId: session.sessionId,
        accessTokenExpiresIn: this.authTokenService.getAccessTokenTtlSeconds(),
      },
    };
  }

  async logout(user: AuthUserContext): Promise<void> {
    const session = await this.authRedisService.revokeSession(user.sessionId);
    if (!session) {
      return;
    }

    this.eventEmitter.emit('auth.session.revoked', new AuthSessionRevokedEvent(user.id, user.sessionId, 'logout'));
  }

  async logoutAll(userId: string): Promise<void> {
    const revokedSessions = await this.authRedisService.revokeUserSessions(userId);
    this.emitSessionRevokedEvents(revokedSessions, 'logout-all');
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<AuthVerificationResponseDto> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new AuthVerificationCodeInvalidException();
    }

    const record = await this.authRedisService.getVerificationCode(user.id);
    const isValid = await this.verifyCodeRecord(
      record,
      dto.code,
      () => this.authRedisService.incrementVerificationAttempts(user.id, AUTH_EMAIL_VERIFICATION_MAX_ATTEMPTS),
      () => this.authRedisService.clearVerificationCode(user.id),
    );

    if (!isValid) {
      throw new AuthVerificationCodeInvalidException();
    }

    const updatedUser = await this.usersService.setEmailVerified(user.id, true);
    this.eventEmitter.emit('auth.email_verified', new AuthEmailVerifiedEvent(updatedUser.id, updatedUser.email));

    return {
      user: this.toAuthUserResponse(updatedUser),
    };
  }

  async resendVerification(dto: ResendVerificationDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || user.emailVerified) {
      return;
    }

    if (await this.authRedisService.isVerificationCooldownActive(user.id)) {
      throw new AuthVerificationCodeRateLimitException();
    }

    await this.issueVerificationCode(user);
  }

  async requestPasswordReset(dto: PasswordResetRequestDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      return;
    }

    const code = this.generateNumericCode(AUTH_PASSWORD_RESET_CODE_LENGTH);
    const record = this.buildCodeRecord(code, this.getPasswordResetTtlMilliseconds());

    await this.authRedisService.setPasswordResetCode(user.id, record, this.getPasswordResetTtlMilliseconds());
    await this.mailerService.send({
      to: user.email,
      subject: 'Reset your password',
      template: AUTH_PASSWORD_RESET_TEMPLATE,
      data: {
        code,
        expiresIn: Math.max(1, Math.ceil(this.getPasswordResetTtlMilliseconds() / 60000)),
      },
    });

    this.eventEmitter.emit('auth.password_reset_requested', new AuthPasswordResetRequestedEvent(user.id, user.email));
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto): Promise<void> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user) {
      throw new AuthPasswordResetTokenExpiredException();
    }

    const record = await this.authRedisService.getPasswordResetCode(user.id);
    const isValid = await this.verifyCodeRecord(
      record,
      dto.code,
      () => this.authRedisService.incrementPasswordResetAttempts(user.id, AUTH_PASSWORD_RESET_MAX_ATTEMPTS),
      () => this.authRedisService.clearPasswordResetCode(user.id),
    );

    if (!isValid) {
      throw new AuthPasswordResetCodeInvalidException();
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.usersService.updatePasswordHash(user.id, passwordHash);

    const revokedSessions = await this.authRedisService.revokeUserSessions(user.id);
    this.emitSessionRevokedEvents(revokedSessions, 'password-reset');
    this.eventEmitter.emit('auth.password_changed', new AuthPasswordChangedEvent(user.id, user.email));
  }

  async changePassword(user: AuthUserContext, dto: ChangePasswordDto): Promise<AuthenticatedUserResult> {
    const currentUser = await this.usersService.findOne(user.id);
    if (!currentUser.passwordHash || !(await this.verifyPassword(dto.currentPassword, currentUser.passwordHash))) {
      throw new AuthInvalidCredentialsException();
    }

    const passwordHash = await this.hashPassword(dto.newPassword);
    await this.usersService.updatePasswordHash(currentUser.id, passwordHash);

    const revokedSessions = await this.authRedisService.revokeUserSessions(currentUser.id);
    this.emitSessionRevokedEvents(revokedSessions, 'password-change');

    return this.createAuthenticatedSession(await this.usersService.findOne(currentUser.id), {
      userAgent: undefined,
      ipAddress: undefined,
    });
  }

  async me(user: AuthUserContext): Promise<AuthUserResponseDto> {
    try {
      const currentUser = await this.usersService.findOne(user.id);
      const permissions = await this.permissionsService.getEffectivePermissions(currentUser.id);
      return this.toAuthUserResponse(currentUser, permissions);
    } catch (error) {
      if (error instanceof EntityNotFoundException) {
        throw new AuthSessionNotFoundException();
      }

      throw error;
    }
  }

  async buildSocialStartUrl(
    provider: AuthSocialProvider,
    redirectUri: string,
    callbackBaseUrl: string,
  ): Promise<string> {
    const normalizedProvider = this.normalizeSocialProvider(provider);
    const normalizedRedirectUri = this.normalizeRedirectUri(redirectUri);
    const state = randomUUID();

    await this.authRedisService.setSocialState(
      state,
      {
        provider: normalizedProvider,
        redirectUri: normalizedRedirectUri,
        createdAt: new Date().toISOString(),
      },
      this.getSocialTtlMilliseconds(),
    );

    const callbackUri = this.buildSocialCallbackUri(callbackBaseUrl, normalizedProvider);
    if (normalizedProvider === 'google') {
      return this.buildGoogleSocialStartUrl(state, callbackUri);
    }

    return this.buildAppleSocialStartUrl(state, callbackUri);
  }

  async completeSocialCallback(
    provider: AuthSocialProvider,
    code: string,
    state: string,
    callbackBaseUrl: string,
  ): Promise<string> {
    const stateRecord = await this.authRedisService.getSocialState(state);
    if (!stateRecord || stateRecord.provider !== provider) {
      throw new AuthSocialFlowInvalidException();
    }

    await this.authRedisService.clearSocialState(state);

    try {
      const profile = await this.resolveSocialProfile(provider, code, callbackBaseUrl);
      const authenticatedResult = await this.finalizeSocialSignIn(profile);
      const handoffCode = randomUUID();

      await this.authRedisService.setSocialResult(
        handoffCode,
        {
          user: authenticatedResult.user,
          tokens: authenticatedResult.tokens,
        },
        this.getSocialTtlMilliseconds(),
      );

      return this.buildSocialRedirectUri(stateRecord.redirectUri, { code: handoffCode });
    } catch {
      return this.buildSocialRedirectUri(stateRecord.redirectUri, {
        error: 'social_auth_failed',
      });
    }
  }

  async exchangeSocialCode(dto: SocialExchangeDto): Promise<AuthenticatedUserResult> {
    const record = await this.authRedisService.getSocialResult(dto.code);
    if (!record) {
      throw new AuthSocialFlowInvalidException();
    }

    await this.authRedisService.clearSocialResult(dto.code);
    return record;
  }

  async exchangeNativeAppleCode(dto: AppleNativeExchangeDto): Promise<AuthenticatedUserResult> {
    const profile = await this.resolveAppleSocialProfile(dto.authorizationCode);
    return this.finalizeSocialSignIn(profile);
  }

  async exchangeNativeGoogleCode(dto: GoogleNativeExchangeDto): Promise<AuthenticatedUserResult> {
    const profile = await this.resolveGoogleNativeProfile(dto.idToken);
    return this.finalizeSocialSignIn(profile);
  }

  private async createAuthenticatedSession(
    user: User,
    context: { userAgent?: string; ipAddress?: string },
  ): Promise<AuthenticatedUserResult> {
    const sessionId = randomUUID();
    const refreshToken = await this.authTokenService.signRefreshToken(user.id, sessionId);
    const refreshTokenHash = this.hashSecret(refreshToken);
    const session = this.buildSessionRecord(user, sessionId, refreshTokenHash, context);
    const ttlMilliseconds = this.getRefreshTokenTtlMilliseconds();

    await this.authRedisService.createSession(session, ttlMilliseconds);
    const accessToken = await this.authTokenService.signAccessToken(user.id, sessionId);

    this.eventEmitter.emit('auth.session.created', new AuthSessionCreatedEvent(user.id, sessionId));

    return {
      user: this.toAuthUserContext(user, sessionId),
      tokens: {
        accessToken,
        refreshToken,
        sessionId,
        accessTokenExpiresIn: this.authTokenService.getAccessTokenTtlSeconds(),
      },
    };
  }

  private async issueVerificationCode(user: User): Promise<void> {
    const code = this.generateNumericCode(AUTH_EMAIL_VERIFICATION_CODE_LENGTH);
    const ttlMilliseconds = this.getEmailVerificationTtlMilliseconds();
    const record = this.buildCodeRecord(code, ttlMilliseconds);

    await this.authRedisService.setVerificationCode(
      user.id,
      record,
      ttlMilliseconds,
      this.getVerificationCooldownMilliseconds(),
    );

    await this.mailerService.send({
      to: user.email,
      subject: 'Verify your email',
      template: AUTH_EMAIL_VERIFICATION_TEMPLATE,
      data: {
        code,
        expiresIn: Math.max(1, Math.ceil(ttlMilliseconds / 60000)),
      },
    });
  }

  private async resolveOrCreateEmailOtpUser(email: string): Promise<User> {
    const existingUser = await this.usersService.findByEmail(email);
    if (existingUser) {
      return existingUser;
    }

    const { firstName, lastName } = this.resolveRegistrationName(email);
    return this.usersService.create({
      email,
      firstName,
      lastName,
      emailVerified: true,
    });
  }

  private async resolveOrCreateSocialUser(email: string): Promise<User> {
    const normalizedEmail = this.normalizeEmail(email);
    const existingUser = await this.usersService.findByEmail(normalizedEmail);
    if (existingUser) {
      return existingUser;
    }

    const { firstName, lastName } = this.resolveRegistrationName(normalizedEmail);
    return this.usersService.create({
      email: normalizedEmail,
      firstName,
      lastName,
      emailVerified: true,
    });
  }

  private async resolveSocialProfile(
    provider: AuthSocialProvider,
    code: string,
    callbackBaseUrl: string,
  ): Promise<SocialProfile> {
    if (provider === 'google') {
      return this.resolveGoogleSocialProfile(code, callbackBaseUrl);
    }

    return this.resolveAppleSocialProfile(code, callbackBaseUrl);
  }

  private async finalizeSocialSignIn(profile: SocialProfile): Promise<AuthenticatedUserResult> {
    const user = await this.resolveOrCreateSocialUser(profile.email);

    let currentUser = user;
    if (!currentUser.emailVerified) {
      currentUser = await this.usersService.setEmailVerified(currentUser.id, true);
      this.eventEmitter.emit('auth.email_verified', new AuthEmailVerifiedEvent(currentUser.id, currentUser.email));
    }

    return this.createAuthenticatedSession(currentUser, {
      userAgent: undefined,
      ipAddress: undefined,
    });
  }

  private async resolveGoogleSocialProfile(code: string, callbackBaseUrl: string): Promise<SocialProfile> {
    const callbackUri = this.buildSocialCallbackUri(callbackBaseUrl, 'google');
    const clientId = this.getSocialConfigValue('auth.googleOAuthClientId');
    const clientSecret = this.getSocialConfigValue('auth.googleOAuthClientSecret');
    const tokenResponse = await this.exchangeGoogleSocialCode(code, callbackUri, clientId, clientSecret);
    const userInfo = await this.fetchGoogleUserInfo(tokenResponse.access_token);
    const idTokenPayload = tokenResponse.id_token
      ? this.decodeJwtPayload<GoogleIdTokenPayload>(tokenResponse.id_token)
      : null;

    const email = userInfo?.email ?? idTokenPayload?.email;
    if (!email) {
      throw new AuthSocialFlowInvalidException();
    }

    const normalizedEmail = this.normalizeEmail(email);
    const firstName = userInfo?.given_name ?? idTokenPayload?.given_name ?? '';
    const lastName = userInfo?.family_name ?? idTokenPayload?.family_name ?? '';

    return {
      email: normalizedEmail,
      firstName,
      lastName,
      providerSubject: userInfo?.sub ?? idTokenPayload?.sub ?? normalizedEmail,
    };
  }

  private async resolveGoogleNativeProfile(idToken: string): Promise<SocialProfile> {
    const idTokenPayload = await this.verifyGoogleIdToken(idToken);
    const email = idTokenPayload.email;
    if (!email) {
      throw new AuthSocialFlowInvalidException();
    }

    const normalizedEmail = this.normalizeEmail(email);
    const firstName = idTokenPayload.given_name ?? '';
    const lastName = idTokenPayload.family_name ?? '';

    return {
      email: normalizedEmail,
      firstName,
      lastName,
      providerSubject: idTokenPayload.sub ?? normalizedEmail,
    };
  }

  private async resolveAppleSocialProfile(code: string, callbackBaseUrl?: string): Promise<SocialProfile> {
    const clientId = this.getSocialConfigValue('auth.appleOAuthClientId');
    const clientSecret = this.buildAppleClientSecret();
    const redirectUri = callbackBaseUrl ? this.buildSocialCallbackUri(callbackBaseUrl, 'apple') : undefined;
    const tokenResponse = await this.exchangeAppleSocialCode(code, redirectUri, clientId, clientSecret);
    const idTokenPayload = tokenResponse.id_token
      ? this.decodeJwtPayload<AppleIdTokenPayload>(tokenResponse.id_token)
      : null;

    const email = idTokenPayload?.email;
    if (!email) {
      throw new AuthSocialFlowInvalidException();
    }

    const normalizedEmail = this.normalizeEmail(email);
    const firstName = idTokenPayload?.given_name ?? '';
    const lastName = idTokenPayload?.family_name ?? '';

    return {
      email: normalizedEmail,
      firstName,
      lastName,
      providerSubject: idTokenPayload?.sub ?? normalizedEmail,
    };
  }

  private async exchangeGoogleSocialCode(
    code: string,
    redirectUri: string,
    clientId: string,
    clientSecret: string,
  ): Promise<SocialTokenResponse> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    });

    return this.parseOAuthTokenResponse<SocialTokenResponse>(response, 'Google');
  }

  private async exchangeAppleSocialCode(
    code: string,
    redirectUri: string | undefined,
    clientId: string,
    clientSecret: string,
  ): Promise<SocialTokenResponse> {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    });

    if (redirectUri) {
      body.set('redirect_uri', redirectUri);
    }

    const response = await fetch('https://appleid.apple.com/auth/token', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    return this.parseOAuthTokenResponse<SocialTokenResponse>(response, 'Apple');
  }

  private async fetchGoogleUserInfo(accessToken?: string): Promise<GoogleUserInfoResponse | null> {
    if (!accessToken) {
      return null;
    }

    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as GoogleUserInfoResponse;
  }

  private async verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenPayload> {
    const decodedToken = jwt.decode(idToken, { complete: true });
    if (
      !decodedToken ||
      typeof decodedToken !== 'object' ||
      !('header' in decodedToken) ||
      !decodedToken.header ||
      typeof decodedToken.header !== 'object' ||
      typeof decodedToken.header.kid !== 'string'
    ) {
      throw new AuthSocialFlowInvalidException();
    }

    const certsResponse = await fetch('https://www.googleapis.com/oauth2/v1/certs');
    if (!certsResponse.ok) {
      throw new AuthSocialFlowInvalidException('Google certificate lookup failed');
    }

    const certs = (await certsResponse.json()) as GoogleCertsResponse;
    const publicKey = certs[decodedToken.header.kid];
    if (!publicKey) {
      throw new AuthSocialFlowInvalidException();
    }

    const audience = this.getSocialConfigValue('auth.googleOAuthClientId');
    const verified = jwt.verify(idToken, publicKey, {
      algorithms: ['RS256'],
      audience,
      issuer: ['accounts.google.com', 'https://accounts.google.com'],
    });

    if (!verified || typeof verified !== 'object') {
      throw new AuthSocialFlowInvalidException();
    }

    return verified as GoogleIdTokenPayload;
  }

  private buildGoogleSocialStartUrl(state: string, callbackUri: string): string {
    const clientId = this.getSocialConfigValue('auth.googleOAuthClientId');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'openid email profile');
    url.searchParams.set('state', state);
    url.searchParams.set('prompt', 'select_account');

    return url.toString();
  }

  private buildAppleSocialStartUrl(state: string, callbackUri: string): string {
    const clientId = this.getSocialConfigValue('auth.appleOAuthClientId');
    const url = new URL('https://appleid.apple.com/auth/authorize');

    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', callbackUri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('response_mode', 'form_post');
    url.searchParams.set('scope', 'name email');
    url.searchParams.set('state', state);

    return url.toString();
  }

  private buildSocialCallbackUri(callbackBaseUrl: string, provider: AuthSocialProvider): string {
    return new URL(`/v1/auth/social/${provider}/callback`, callbackBaseUrl).toString();
  }

  private buildSocialRedirectUri(redirectUri: string, params: { code?: string; error?: string }): string {
    const url = new URL(redirectUri);
    if (params.code) {
      url.searchParams.set('code', params.code);
    }
    if (params.error) {
      url.searchParams.set('error', params.error);
    }

    return url.toString();
  }

  private buildAppleClientSecret(): string {
    const clientId = this.getSocialConfigValue('auth.appleOAuthClientId');
    const teamId = this.getSocialConfigValue('auth.appleOAuthTeamId');
    const keyId = this.getSocialConfigValue('auth.appleOAuthKeyId');
    const privateKey = this.getSocialConfigValue('auth.appleOAuthPrivateKey');
    const now = Math.floor(Date.now() / 1000);

    return jwt.sign(
      {
        iss: teamId,
        iat: now,
        exp: now + 300,
        aud: 'https://appleid.apple.com',
        sub: clientId,
      },
      privateKey,
      {
        algorithm: 'ES256',
        keyid: keyId,
        header: {
          alg: 'ES256',
          kid: keyId,
        },
      },
    );
  }

  private async parseOAuthTokenResponse<T>(response: Response, provider: 'Google' | 'Apple'): Promise<T> {
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new AuthSocialFlowInvalidException(`${provider} OAuth failed${body ? `: ${body}` : ''}`);
    }

    return (await response.json()) as T;
  }

  private decodeJwtPayload<T>(token: string): T {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== 'object') {
      throw new AuthSocialFlowInvalidException();
    }

    return decoded as T;
  }

  private normalizeSocialProvider(provider: AuthSocialProvider): AuthSocialProvider {
    if (provider === 'google' || provider === 'apple') {
      return provider;
    }

    throw new AuthSocialFlowInvalidException();
  }

  private getSocialConfigValue(key: string): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new AuthSocialProviderUnavailableException();
    }

    return value;
  }

  private normalizeRedirectUri(redirectUri: string): string {
    const normalizedRedirectUri = redirectUri.trim();
    if (!normalizedRedirectUri.startsWith('workspace-auth://')) {
      throw new AuthSocialFlowInvalidException();
    }

    return normalizedRedirectUri;
  }

  private getSocialTtlMilliseconds(): number {
    return this.getEmailVerificationTtlMilliseconds();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private async verifyCodeRecord(
    record: AuthCodeRecord | null,
    code: string,
    incrementAttempts: () => Promise<AuthCodeRecord | null>,
    clearCode: () => Promise<void>,
  ): Promise<boolean> {
    if (!record) {
      return false;
    }

    const expectedHash = this.hashSecret(code);
    if (record.codeHash !== expectedHash) {
      const attemptsRecord = await incrementAttempts();
      if (!attemptsRecord) {
        await clearCode();
      }

      return false;
    }

    await clearCode();
    return true;
  }

  private buildSessionRecord(
    user: User,
    sessionId: string,
    refreshTokenHash: string,
    context: { userAgent?: string; ipAddress?: string },
  ): AuthSessionRecord {
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + this.getRefreshTokenTtlMilliseconds()).toISOString();

    return {
      sessionId,
      userId: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      refreshTokenHash,
      userAgent: context.userAgent ?? null,
      ipAddress: context.ipAddress ?? null,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };
  }

  private buildCodeRecord(code: string, ttlMilliseconds: number): AuthCodeRecord {
    const createdAt = new Date().toISOString();
    return {
      codeHash: this.hashSecret(code),
      attempts: 0,
      createdAt,
      expiresAt: new Date(Date.now() + ttlMilliseconds).toISOString(),
    };
  }

  private resolveRegistrationName(
    email: string,
    firstName?: string,
    lastName?: string,
  ): { firstName: string; lastName: string } {
    if (firstName || lastName) {
      return {
        firstName: firstName?.trim() || AUTH_DEFAULT_DISPLAY_NAME,
        lastName: lastName?.trim() || '',
      };
    }

    const localPart = email.split('@')[0] || AUTH_DEFAULT_DISPLAY_NAME;
    const normalizedLocalPart = localPart.replace(/[._-]+/g, ' ').trim();

    return {
      firstName: normalizedLocalPart || AUTH_DEFAULT_DISPLAY_NAME,
      lastName: '',
    };
  }

  private toAuthUserContext(user: User, sessionId: string): AuthUserContext {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      sessionId,
    };
  }

  private toAuthUserResponse(user: User, permissions?: string[]): AuthUserResponseDto {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      permissions,
    };
  }

  private emitSessionRevokedEvents(sessions: AuthSessionRecord[], reason: AuthSessionRevokedEvent['reason']): void {
    sessions.forEach((session) => {
      this.eventEmitter.emit(
        'auth.session.revoked',
        new AuthSessionRevokedEvent(session.userId, session.sessionId, reason),
      );
    });
  }

  private async hashPassword(password: string): Promise<string> {
    return hashPassword(password, AUTH_PASSWORD_HASH_ROUNDS);
  }

  private async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return comparePassword(password, passwordHash);
  }

  private hashSecret(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private generateNumericCode(length: number): string {
    const upperBound = 10 ** length;
    return String(randomInt(0, upperBound)).padStart(length, '0');
  }

  private getEmailVerificationTtlMilliseconds(): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>('auth.emailCodeExpiresIn'));
  }

  private getVerificationCooldownMilliseconds(): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>('auth.emailCodeResendCooldown'));
  }

  private getPasswordResetTtlMilliseconds(): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>('auth.passwordResetExpiresIn'));
  }

  private getRefreshTokenTtlMilliseconds(): number {
    return parseDurationToMilliseconds(this.configService.getOrThrow<string>('auth.refreshTokenExpiresIn'));
  }
}
