import { HttpException, HttpStatus } from '@nestjs/common';

import { AVATAR_ALLOWED_MIME_TYPES } from '../constants/avatar.constants';

/** Thrown when the uploaded file is not an image type we accept. */
export class AvatarInvalidFileException extends HttpException {
  constructor(receivedMimeType?: string) {
    super(
      {
        statusCode: HttpStatus.BAD_REQUEST,
        code: 'AVATAR_INVALID_FILE',
        message: `Avatar must be one of: ${AVATAR_ALLOWED_MIME_TYPES.join(', ')}`,
        receivedMimeType,
      },
      HttpStatus.BAD_REQUEST,
    );
  }
}
