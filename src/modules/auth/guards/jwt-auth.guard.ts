import { ExecutionContext, Injectable } from '@nestjs/common';
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

  override handleRequest<TUser = AuthUserContext>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw new AuthTokenInvalidException();
    }

    return user;
  }
}
