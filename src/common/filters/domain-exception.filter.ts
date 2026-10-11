import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { OptimisticLockError } from 'sequelize';

import { DomainException } from '../exceptions/domain.exception';
import { getTraceId } from '../middleware/correlation-id.middleware';

const DEFAULT_LANGUAGE = 'en';
const INTERNAL_ERROR_CODE = 'INTERNAL_ERROR';
const INTERNAL_ERROR_MESSAGE = 'Internal server error';

/**
 * Codes for exceptions thrown by Nest and its libraries (unknown route, throttler,
 * passport, body parser) — they carry a status but no domain code of their own.
 */
const HTTP_STATUS_CODES: Readonly<Partial<Record<number, string>>> = {
  [HttpStatus.BAD_REQUEST]: 'BAD_REQUEST',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORIZED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'TOO_MANY_REQUESTS',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'SERVICE_UNAVAILABLE',
};

interface ErrorResponseBody {
  statusCode: number;
  code: string;
  message: string;
  traceId: string;
  timestamp: string;
  path: string;
  details?: Record<string, unknown>;
}

/**
 * Single place where exceptions become HTTP responses.
 *
 * `code` is the stable contract for clients; `message` is translated into the
 * request language and is for display only. 5xx responses never expose the
 * original message: it may contain internals and goes to the log instead.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  constructor(private readonly i18n: I18nService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const error = this.normalize(exception);
    const status = error instanceof HttpException ? error.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    const code = this.resolveCode(error, status);
    const originalMessage = this.resolveMessage(error);
    const traceId = getTraceId();
    const lang = I18nContext.current(host)?.lang ?? DEFAULT_LANGUAGE;

    const body: ErrorResponseBody = {
      statusCode: status,
      code,
      message: await this.translate(code, lang, isServerError ? INTERNAL_ERROR_MESSAGE : originalMessage),
      traceId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    const details = error instanceof DomainException ? error.details : undefined;
    if (details && !isServerError) {
      body.details = details;
    }

    if (isServerError) {
      this.logger.error(
        `[${traceId}] ${request.method} ${request.url} - ${status} ${code}: ${originalMessage}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      // Business rejections are expected outcomes, not errors (see guidelines, section 14).
      this.logger.warn(`[${traceId}] ${request.method} ${request.url} - ${status} ${code}`);
    }

    response.status(status).json(body);
  }

  /** A concurrent write of a versioned row is a client-visible conflict, not a server error. */
  private normalize(exception: unknown): unknown {
    if (exception instanceof OptimisticLockError) {
      return new DomainException(
        exception.modelName === 'TrainingPlan' ? 'PLAN_VERSION_CONFLICT' : 'VERSION_CONFLICT',
        'The resource was modified concurrently',
        HttpStatus.CONFLICT,
      );
    }
    return exception;
  }

  private resolveCode(error: unknown, status: number): string {
    if (error instanceof DomainException) {
      return error.code;
    }
    return HTTP_STATUS_CODES[status] ?? INTERNAL_ERROR_CODE;
  }

  private resolveMessage(error: unknown): string {
    if (error instanceof HttpException) {
      const payload = error.getResponse();
      if (typeof payload === 'string') {
        return payload;
      }
      const message = (payload as { message?: unknown }).message;
      return Array.isArray(message) ? message.join('; ') : String(message ?? error.message);
    }
    return error instanceof Error ? error.message : INTERNAL_ERROR_MESSAGE;
  }

  /**
   * Looks the code up as a full i18n key first (`user.ERRORS.USER_NOT_FOUND`),
   * then among the shared `common.ERRORS`; falls back to the English message.
   */
  private async translate(code: string, lang: string, fallback: string): Promise<string> {
    try {
      const direct = this.i18n.translate(code, { lang, defaultValue: '' }) as string;
      if (direct) {
        return direct;
      }
      return this.i18n.translate(`common.ERRORS.${code}`, { lang, defaultValue: fallback }) as string;
    } catch (translationError) {
      this.logger.warn(`Failed to translate error code ${code}: ${String(translationError)}`);
      return fallback;
    }
  }
}
