import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { DomainConflictException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { AUTH_EVENTS } from '@/modules/auth/auth.events';
import { User } from '@/modules/users/entities/user.entity';
import { UsersService } from '@/modules/users/users.service';

import { normalizeEmail, resolveRegistrationName } from '../auth.helpers';
import { AuthIdentityResponseDto } from '../dto/auth-identity.dto';
import { UserIdentity } from '../entities/user-identity.entity';
import { AuthIdentityChangedEvent } from '../events/auth-identity-changed.event';
import type { AuthSocialProvider } from '../interfaces/auth-social-provider.interface';
import type { SocialProfile } from './social-identity.service';

/** Which social accounts belong to which user: sign-in resolution, linking and unlinking. */
@Injectable()
export class UserIdentityService {
  constructor(
    @InjectModel(UserIdentity)
    private readonly identityModel: typeof UserIdentity,
    private readonly usersService: UsersService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * The user a social sign-in belongs to. A known provider account wins; otherwise
   * the account with the same email is used (how accounts were matched before
   * identities were stored) or a new one is created. The identity is remembered either way.
   */
  async resolveUser(provider: AuthSocialProvider, profile: SocialProfile): Promise<User> {
    const known = await this.identityModel.findOne({ where: { provider, subject: profile.providerSubject } });
    if (known) {
      const owner = await this.usersService.findOne(known.userId).catch((error: unknown) => {
        if (error instanceof EntityNotFoundException) {
          return null;
        }
        throw error;
      });
      if (owner) {
        return owner;
      }
      // The account behind the identity was deleted; the provider account starts over.
      await known.destroy();
    }
    const email = normalizeEmail(profile.email);
    const user =
      (await this.usersService.findByEmail(email)) ??
      (await this.usersService.create({ email, ...resolveRegistrationName(email), emailVerified: true }));
    const taken = await this.identityModel.findOne({ where: { userId: user.id, provider } });
    if (!taken) {
      await this.identityModel.create({ userId: user.id, provider, subject: profile.providerSubject, email });
    }
    return user;
  }

  async list(userId: string): Promise<AuthIdentityResponseDto[]> {
    const identities = await this.identityModel.findAll({ where: { userId }, order: [['createdAt', 'ASC']] });
    return identities.map((identity) => ({
      provider: identity.provider,
      email: identity.email,
      linkedAt: identity.createdAt,
    }));
  }

  /** Links a provider account to the signed-in user; the account must not belong to someone else. */
  async link(userId: string, provider: AuthSocialProvider, profile: SocialProfile): Promise<AuthIdentityResponseDto> {
    const owner = await this.identityModel.findOne({ where: { provider, subject: profile.providerSubject } });
    if (owner && owner.userId !== userId) {
      throw new DomainConflictException('AUTH_IDENTITY_IN_USE', 'This account is already linked to another user');
    }
    const existing = await this.identityModel.findOne({ where: { userId, provider } });
    if (existing && existing.subject !== profile.providerSubject) {
      throw new DomainConflictException('AUTH_IDENTITY_ALREADY_LINKED', 'Unlink the current account first');
    }
    const identity =
      existing ??
      (await this.identityModel.create({
        userId,
        provider,
        subject: profile.providerSubject,
        email: normalizeEmail(profile.email),
      }));
    if (!existing) {
      this.eventEmitter.emit(AUTH_EVENTS.IDENTITY_LINKED, new AuthIdentityChangedEvent(userId, provider));
    }
    return { provider, email: identity.email, linkedAt: identity.createdAt };
  }

  /** Email codes always work, so unlinking never locks the user out. */
  async unlink(userId: string, provider: AuthSocialProvider): Promise<void> {
    const deleted = await this.identityModel.destroy({ where: { userId, provider } });
    if (deleted === 0) {
      throw new DomainNotFoundException('AUTH_IDENTITY_NOT_FOUND', 'This account is not linked');
    }
    this.eventEmitter.emit(AUTH_EVENTS.IDENTITY_UNLINKED, new AuthIdentityChangedEvent(userId, provider));
  }
}
