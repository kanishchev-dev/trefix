import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { UserBlockedException } from '@/modules/users/exceptions/user-blocked.exception';
import { isUserBlocked } from '@/modules/users/user-status';
import { UsersService } from '@/modules/users/users.service';

import { AuthSessionNotFoundException } from '../exceptions/auth-session-not-found.exception';
import { AuthTokenInvalidException } from '../exceptions/auth-token-invalid.exception';
import { AuthJwtPayload } from '../interfaces/auth-jwt-payload.interface';
import { AuthUserContext } from '../interfaces/auth-user-context.interface';
import { AuthRedisService } from '../services/auth-redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly authRedisService: AuthRedisService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('auth.accessTokenSecret'),
    });
  }

  async validate(payload: AuthJwtPayload): Promise<AuthUserContext> {
    if (payload.tokenType !== 'access' || !payload.sub || !payload.sessionId) {
      throw new AuthTokenInvalidException();
    }

    const session = await this.authRedisService.getSession(payload.sessionId);
    if (!session || session.userId !== payload.sub) {
      throw new AuthSessionNotFoundException();
    }

    let user: Awaited<ReturnType<UsersService['findOne']>>;
    try {
      user = await this.usersService.findOne(payload.sub);
    } catch (error) {
      if (error instanceof EntityNotFoundException) {
        await this.authRedisService.revokeSession(payload.sessionId);
        throw new AuthSessionNotFoundException();
      }

      throw error;
    }

    // Sessions kept on purpose when blocking (or left from before) stop working at once.
    if (isUserBlocked(user)) {
      throw new UserBlockedException(user.blockedUntil);
    }

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      sessionId: payload.sessionId,
    };
  }
}
