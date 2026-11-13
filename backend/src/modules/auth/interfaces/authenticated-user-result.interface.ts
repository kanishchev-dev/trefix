import { User } from '@/modules/users/entities/user.entity';

import { AuthTokenResult } from './auth-token-result.interface';

/**
 * A freshly issued session together with everything the client needs to render
 * an authenticated UI.
 *
 * `permissions` is part of the result on purpose. The sign-in response *is* the
 * client's first and only source of the effective permission set: the frontend
 * seeds its auth context from it and the session bootstrap does not run again
 * for the rest of the page's life. Leaving `permissions` out made every
 * permission check answer "no" right after a successful sign-in, which showed up
 * as an almost empty sidebar and denied access to the sections that were visible.
 * A reload papered over it, because that path goes through `GET /auth/me`, which
 * has always returned them.
 */
export interface AuthenticatedUserResult {
  user: User;
  tokens: AuthTokenResult;
  permissions: string[];
}
