import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nService } from 'nestjs-i18n';

import { requestContext } from '../middleware/correlation-id.middleware';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  constructor(private readonly i18n: I18nService) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const traceId = requestContext.getStore()?.get('traceId') || 'no-trace-id';
    const acceptLanguage = request.headers['accept-language'];
    const lang = Array.isArray(acceptLanguage) ? acceptLanguage[0] : acceptLanguage || 'en';

    const responseMessage = exception instanceof HttpException ? exception.getResponse() : 'Internal server error';
    let message =
      typeof responseMessage === 'object'
        ? String((responseMessage as Record<string, unknown>).message || 'Internal server error')
        : String(responseMessage);

    const code =
      typeof exception === 'object' && exception !== null && 'code' in exception
        ? String((exception as Record<string, unknown>).code)
        : 'INTERNAL_ERROR';

    try {
      let translated = (await this.i18n.translate(String(code), {
        lang,
        defaultValue: '',
      })) as string;

      if (!translated) {
        translated = (await this.i18n.translate(`common.ERRORS.${String(code)}`, {
          lang,
          defaultValue: message,
        })) as string;
      }

      message = translated;
    } catch {
      // Fallback to original message
    }

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message,
      code,
      traceId,
    };

    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `[${traceId}] ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : '',
      );
    } else {
      this.logger.warn(`[${traceId}] ${request.method} ${request.url} - ${status} - ${message}`);
    }

    response.status(status).json(errorResponse);
  }
}
