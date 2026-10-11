import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';
import { ActivateInviteDto } from '@/modules/users/dto/activate-invite.dto';
import { UpdateUserDto } from '@/modules/users/dto/update-user.dto';
import { UserActivatedEvent } from '@/modules/users/events/user-activated.event';
import { UserInviteService } from '@/modules/users/services/user-invite.service';
import { USERS_EVENTS } from '@/modules/users/users.events';
import { UsersService } from '@/modules/users/users.service';

import { hashUserPassword, resolveRegistrationName, toAuthUserResponse, verifyUserPassword } from './auth.helpers';
import { AuthRegisterResponseDto } from './dto/auth-register-response.dto';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthPasswordChangedEvent } from './events/auth-password-changed.event';
import { AuthRegisteredEvent } from './events/auth-registered.event';
import { AuthEmailAlreadyExistsException } from './exceptions/auth-email-already-exists.exception';
import { AuthEmailNotVerifiedException } from './exceptions/auth-email-not-verified.exception';
import { AuthInvalidCredentialsException } from './exceptions/auth-invalid-credentials.exception';
import { AuthInviteAlreadyActivatedException } from './exceptions/auth-invite-already-activated.exception';
import { AuthInviteCodeInvalidException } from './exceptions/auth-invite-code-invalid.exception';
import { AuthSessionNotFoundException } from './exceptions/auth-session-not-found.exception';
import { AuthUserContext } from './interfaces/auth-user-context.interface';
import { AuthenticatedUserResult } from './interfaces/authenticated-user-result.interface';
import { AuthCodeService } from './services/auth-code.service';
import { AuthRedisService } from './services/auth-redis.service';
import { AuthSessionService } from './services/auth-session.service';

/**
 * Account flows: registration, password login and change, invite activation, the current user.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userInviteService: UserInviteService,
    private readonly authRedisService: AuthRedisService,
    private readonly userPermissionsService: UserPermissionsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly authCodeService: AuthCodeService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthRegisterResponseDto> {
    const existingUser = await this.usersService.findByEmail(dto.email);
    if (existingUser) {
      throw new AuthEmailAlreadyExistsException();
    }

    const passwordHash = await hashUserPassword(dto.password);
    const { firstName, lastName } = resolveRegistrationName(dto.email, dto.firstName, dto.lastName);

    const user = await this.usersService.create({
      email: dto.email,
      firstName,
      lastName,
      passwordHash,
      emailVerified: false,
    });

    await this.authCodeService.issueVerificationCode(user);
    this.eventEmitter.emit(AUTH_EVENTS.REGISTERED, new AuthRegisteredEvent(user.id, user.email));

    return {
      user: toAuthUserResponse(user),
      emailVerificationRequired: true,
    };
  }

  async login(
    dto: LoginDto,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthenticatedUserResult> {
    const user = await this.usersService.findByEmail(dto.email);
    if (!user || !user.passwordHash) {
      throw new AuthInvalidCredentialsException();
    }

    const passwordMatches = await verifyUserPassword(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new AuthInvalidCredentialsException();
    }

    if (!user.emailVerified) {
      throw new AuthEmailNotVerifiedException();
    }

    return this.authSessionService.createAuthenticatedSession(user, context);
  }

  async changePassword(user: AuthUserContext, dto: ChangePasswordDto): Promise<AuthenticatedUserResult> {
    const currentUser = await this.usersService.findOne(user.id);
    if (!currentUser.passwordHash || !(await verifyUserPassword(dto.currentPassword, currentUser.passwordHash))) {
      throw new AuthInvalidCredentialsException();
    }

    const passwordHash = await hashUserPassword(dto.newPassword);
    await this.usersService.updatePasswordHash(currentUser.id, passwordHash);

    const revokedSessions = await this.authRedisService.revokeUserSessions(currentUser.id);
    this.authSessionService.emitSessionRevokedEvents(revokedSessions, 'password-change');

    return this.authSessionService.createAuthenticatedSession(await this.usersService.findOne(currentUser.id), {
      userAgent: undefined,
      ipAddress: undefined,
    });
  }

  /**
   * Completes the admin invite flow: an invited (passwordless) user sets their
   * own password using the one-time code from the invite email and is signed
   * in immediately afterwards.
   * @param dto - Email, invite code and the new password
   * @returns The activated user together with a fresh session
   */
  async activateInvite(
    dto: ActivateInviteDto,
    context: { userAgent?: string; ipAddress?: string } = {},
  ): Promise<AuthenticatedUserResult> {
    const user = await this.usersService.findByEmail(dto.email);
    // Same response for unknown email and wrong code so the endpoint cannot
    // be used to enumerate accounts.
    const isValidInvite =
      Boolean(user) && !user!.passwordHash && (await this.userInviteService.consumeInviteCode(user!.id, dto.code));

    if (!isValidInvite) {
      if (user?.passwordHash) {
        throw new AuthInviteAlreadyActivatedException();
      }

      throw new AuthInviteCodeInvalidException();
    }

    const passwordHash = await hashUserPassword(dto.newPassword);
    // Activation also confirms the address: the invite was delivered to it.
    const activatedUser = await this.usersService.updatePasswordAndVerification(user!.id, {
      passwordHash,
      emailVerified: true,
    });

    this.eventEmitter.emit(
      AUTH_EVENTS.PASSWORD_CHANGED,
      new AuthPasswordChangedEvent(activatedUser.id, activatedUser.email),
    );
    this.eventEmitter.emit(USERS_EVENTS.USER_UPDATED, new UserActivatedEvent(activatedUser.id, activatedUser.email));

    return this.authSessionService.createAuthenticatedSession(activatedUser, context);
  }

  async me(user: AuthUserContext): Promise<AuthUserResponseDto> {
    try {
      const currentUser = await this.usersService.findOne(user.id);
      const permissions = await this.userPermissionsService.getEffectivePermissions(currentUser.id);
      return toAuthUserResponse(currentUser, permissions);
    } catch (error) {
      if (error instanceof EntityNotFoundException) {
        throw new AuthSessionNotFoundException();
      }

      throw error;
    }
  }

  async updateMe(user: AuthUserContext, dto: UpdateUserDto): Promise<AuthUserResponseDto> {
    const updatedUser = await this.usersService.update(user.id, dto);
    const permissions = await this.userPermissionsService.getEffectivePermissions(updatedUser.id);
    return toAuthUserResponse(updatedUser, permissions);
  }
}
