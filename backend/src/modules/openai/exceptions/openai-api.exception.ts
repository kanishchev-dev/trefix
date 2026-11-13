import { HttpException, HttpStatus } from '@nestjs/common';

export class OpenAiApiException extends HttpException {
  constructor(message: string, cause?: unknown) {
    super(
      {
        code: 'OPENAI_API_ERROR',
        message,
        cause: cause instanceof Error ? cause.message : undefined,
      },
      HttpStatus.BAD_GATEWAY,
    );
  }
}
