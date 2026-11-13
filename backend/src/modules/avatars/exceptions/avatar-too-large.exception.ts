import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

import { AVATAR_MAX_SIZE_BYTES } from '../constants/avatar.constants';

/** Thrown when the uploaded avatar exceeds {@link AVATAR_MAX_SIZE_BYTES}. */
export class AvatarTooLargeException extends DomainException {
  constructor(maxSizeBytes: number = AVATAR_MAX_SIZE_BYTES) {
    super('AVATAR_TOO_LARGE', `Avatar must not exceed ${maxSizeBytes} bytes`, HttpStatus.PAYLOAD_TOO_LARGE, {
      maxSizeBytes,
    });
  }
}
