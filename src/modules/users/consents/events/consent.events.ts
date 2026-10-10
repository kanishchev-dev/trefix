import type { ConsentType } from '../consents.constants';

/** `users.consent_given` */
export class ConsentGivenEvent {
  constructor(
    public readonly userId: string,
    public readonly type: ConsentType,
    public readonly version: string,
  ) {}
}

/** `users.consent_revoked` */
export class ConsentRevokedEvent {
  constructor(
    public readonly userId: string,
    public readonly type: ConsentType,
  ) {}
}
