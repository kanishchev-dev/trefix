import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

export class AuthRefreshTokenReuseException extends DomainException {
  constructor() {
    super('AUTH_REFRESH_TOKEN_REUSED', 'Refresh token reuse was detected', HttpStatus.UNAUTHORIZED);
  }
}
