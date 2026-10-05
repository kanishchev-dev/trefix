import { HttpException, HttpStatus } from '@nestjs/common';

import { AVATAR_MAX_SIZE_BYTES } from '../constants/avatar.constants';

/** Thrown when the uploaded avatar exceeds {@link AVATAR_MAX_SIZE_BYTES}. */
export class AvatarTooLargeException extends HttpException {
  constructor(maxSizeBytes: number = AVATAR_MAX_SIZE_BYTES) {
    super(
      {
        statusCode: HttpStatus.PAYLOAD_TOO_LARGE,
        code: 'AVATAR_TOO_LARGE',
        message: `Avatar must not exceed ${maxSizeBytes} bytes`,
        maxSizeBytes,
      },
      HttpStatus.PAYLOAD_TOO_LARGE,
    );
  }
}
