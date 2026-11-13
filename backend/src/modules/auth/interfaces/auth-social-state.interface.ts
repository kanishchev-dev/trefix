import { AuthSocialProvider } from './auth-social-provider.interface';

export interface AuthSocialStateRecord {
  provider: AuthSocialProvider;
  redirectUri: string;
  createdAt: string;
}
