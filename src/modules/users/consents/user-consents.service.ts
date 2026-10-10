import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';

import { CONSENT_TYPES, type ConsentType, CURRENT_CONSENT_VERSIONS } from './consents.constants';
import { ConsentResponseDto, ConsentsListResponseDto, GiveConsentDto } from './dto/consent.dto';
import { ConsentGivenEvent, ConsentRevokedEvent } from './events/consent.events';
import { UserConsent } from './user-consent.entity';

@Injectable()
export class UserConsentsService {
  constructor(
    @InjectModel(UserConsent)
    private readonly consentModel: typeof UserConsent,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(userId: string): Promise<ConsentsListResponseDto> {
    const items: ConsentResponseDto[] = [];
    for (const type of CONSENT_TYPES) {
      const latest = await this.latest(userId, type);
      if (latest) {
        items.push(this.toResponse(latest));
      }
    }
    return { items, currentVersions: { ...CURRENT_CONSENT_VERSIONS } };
  }

  /** Accepting the current version again is a no-op that returns the active record. */
  async give(userId: string, dto: GiveConsentDto): Promise<ConsentResponseDto> {
    if (dto.version !== CURRENT_CONSENT_VERSIONS[dto.type]) {
      throw new DomainException(
        'CONSENT_VERSION_OUTDATED',
        'The consent text version is outdated; reload the text and accept it again',
        HttpStatus.UNPROCESSABLE_ENTITY,
        { currentVersion: CURRENT_CONSENT_VERSIONS[dto.type] },
      );
    }
    const latest = await this.latest(userId, dto.type);
    if (latest && !latest.revokedAt && latest.version === dto.version) {
      return this.toResponse(latest);
    }
    const consent = await this.consentModel.create({
      userId,
      type: dto.type,
      version: dto.version,
      acceptedAt: new Date(),
      client: dto.client ?? {},
    });
    this.eventEmitter.emit('users.consent_given', new ConsentGivenEvent(userId, dto.type, dto.version));
    return this.toResponse(consent);
  }

  /** Revokes every active record of the type. Revoking an absent consent is a no-op. */
  async revoke(userId: string, type: ConsentType): Promise<{ success: true }> {
    const [revoked] = await this.consentModel.update(
      { revokedAt: new Date() },
      { where: { userId, type, revokedAt: null } },
    );
    if (revoked > 0) {
      await this.eventEmitter.emitAsync('users.consent_revoked', new ConsentRevokedEvent(userId, type));
    }
    return { success: true };
  }

  /** Active consent for the current text version. */
  async hasCurrent(userId: string, type: ConsentType): Promise<boolean> {
    const latest = await this.latest(userId, type);
    return this.isCurrent(latest);
  }

  async assertCurrent(userId: string, type: ConsentType): Promise<void> {
    if (!(await this.hasCurrent(userId, type))) {
      throw new DomainException(
        type === 'health_data' ? 'HEALTH_CONSENT_REQUIRED' : 'CONSENT_REQUIRED',
        'Accept the current consent before continuing',
        HttpStatus.FORBIDDEN,
        { type, currentVersion: CURRENT_CONSENT_VERSIONS[type] },
      );
    }
  }

  private latest(userId: string, type: ConsentType): Promise<UserConsent | null> {
    return this.consentModel.findOne({ where: { userId, type }, order: [['acceptedAt', 'DESC']] });
  }

  private isCurrent(consent: UserConsent | null): boolean {
    return !!consent && !consent.revokedAt && consent.version === CURRENT_CONSENT_VERSIONS[consent.type];
  }

  private toResponse(consent: UserConsent): ConsentResponseDto {
    return {
      type: consent.type,
      version: consent.version,
      acceptedAt: consent.acceptedAt,
      revokedAt: consent.revokedAt,
      isCurrent: this.isCurrent(consent),
    };
  }
}
