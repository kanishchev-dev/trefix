import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

import { AVATAR_ALLOWED_MIME_TYPES } from '../constants/avatar.constants';

/** Thrown when the uploaded file is missing or is not an image type we accept. */
export class AvatarInvalidFileException extends DomainException {
  constructor(receivedMimeType?: string) {
    super(
      'AVATAR_INVALID_FILE',
      `Avatar must be one of: ${AVATAR_ALLOWED_MIME_TYPES.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      receivedMimeType ? { receivedMimeType } : undefined,
    );
  }
}
