import { AuthTokenResult } from './auth-token-result.interface';
import { AuthUserContext } from './auth-user-context.interface';

export interface AuthSocialResultRecord {
  user: AuthUserContext;
  tokens: AuthTokenResult;
}
