import type { AuthSocialProvider } from '../interfaces/auth-social-provider.interface';

export class AuthIdentityChangedEvent {
  constructor(
    public readonly userId: string,
    public readonly provider: AuthSocialProvider,
  ) {}
}
