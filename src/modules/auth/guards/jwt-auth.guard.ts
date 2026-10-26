import { ExecutionContext, HttpException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';

import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';

import { AuthTokenInvalidException } from '../exceptions/auth-token-invalid.exception';
import { AuthUserContext } from '../interfaces/auth-user-context.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * A missing, malformed or expired token is a 401 the client answers with a
   * refresh. Anything `validate` threw on purpose keeps its own status and code
   * (a revoked session stays 401, a blocked account is 403), and an
   * infrastructure failure (Redis, database) stays a 5xx: turning it into a 401
   * would sign the user out because of a server hiccup.
   */
  override handleRequest<TUser = AuthUserContext>(err: unknown, user: TUser): TUser {
    if (err instanceof HttpException) {
      throw err;
    }
    if (err) {
      throw err instanceof Error ? err : new Error(String(err));
    }
    if (!user) {
      throw new AuthTokenInvalidException();
    }

    return user;
  }
}
