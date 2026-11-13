import { ArgumentsHost, HttpStatus, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { I18nContext, I18nService } from 'nestjs-i18n';

import { DomainException } from '../exceptions/domain.exception';
import { EntityNotFoundException } from '../exceptions/entity-not-found.exception';
import { InvariantViolationException } from '../exceptions/invariant-violation.exception';
import { ValidationException } from '../exceptions/validation.exception';
import { DomainExceptionFilter } from './domain-exception.filter';

interface CapturedResponse {
  status: number;
  body: Record<string, unknown>;
}

function createHost(captured: CapturedResponse): ArgumentsHost {
  interface FakeResponse {
    status(code: number): FakeResponse;
    json(body: Record<string, unknown>): FakeResponse;
  }
  const response: FakeResponse = {
    status(code) {
      captured.status = code;
      return response;
    },
    json(body) {
      captured.body = body;
      return response;
    },
  };
  const request = { method: 'GET', url: '/v1/plans/1', headers: {} };

  return {
    switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
  } as unknown as ArgumentsHost;
}

describe('DomainExceptionFilter', () => {
  const translations: Record<string, Record<string, string>> = {
    ru: { 'common.ERRORS.PLAN_NOT_FOUND': 'План не найден', 'common.ERRORS.INTERNAL_ERROR': 'Что-то пошло не так' },
    en: {},
  };
  const i18n = {
    translate: jest.fn((key: string, options: { lang: string; defaultValue: string }) => {
      return translations[options.lang]?.[key] ?? options.defaultValue;
    }),
  } as unknown as I18nService;

  let filter: DomainExceptionFilter;
  let captured: CapturedResponse;

  beforeEach(() => {
    filter = new DomainExceptionFilter(i18n);
    captured = { status: 0, body: {} };
    jest.spyOn(I18nContext, 'current').mockReturnValue(undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('keeps the domain code and translates the message into the resolved request language', async () => {
    jest.spyOn(I18nContext, 'current').mockReturnValue({ lang: 'ru' } as I18nContext);

    await filter.catch(
      new DomainException('PLAN_NOT_FOUND', 'Plan not found', HttpStatus.NOT_FOUND),
      createHost(captured),
    );

    expect(captured.status).toBe(HttpStatus.NOT_FOUND);
    expect(captured.body).toMatchObject({ code: 'PLAN_NOT_FOUND', message: 'План не найден', statusCode: 404 });
  });

  it('fills message placeholders from the exception', async () => {
    (i18n.translate as jest.Mock).mockImplementationOnce((key: string, options: { args: Record<string, unknown> }) =>
      key === 'common.ERRORS.USER_NOT_FOUND' ? `User with ID ${String(options.args.id)} not found` : '',
    );

    await filter.catch(new EntityNotFoundException('User', 'u-1'), createHost(captured));

    expect(captured.body).toMatchObject({ code: 'USER_NOT_FOUND', message: 'User with ID u-1 not found' });
  });

  it('falls back to English when the request has no language context', async () => {
    await filter.catch(
      new DomainException('PLAN_NOT_FOUND', 'Plan not found', HttpStatus.NOT_FOUND),
      createHost(captured),
    );

    expect(captured.body.message).toBe('Plan not found');
  });

  it('reports validation failures as VALIDATION_ERROR with per-field details', async () => {
    const exception = new ValidationException([{ path: 'startDate', constraints: { isDateString: 'invalid' } }]);

    await filter.catch(exception, createHost(captured));

    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body).toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { errors: [{ path: 'startDate', constraints: { isDateString: 'invalid' } }] },
    });
  });

  it.each([
    [new NotFoundException(), HttpStatus.NOT_FOUND, 'NOT_FOUND'],
    [new ThrottlerException(), HttpStatus.TOO_MANY_REQUESTS, 'TOO_MANY_REQUESTS'],
    [new ServiceUnavailableException(), HttpStatus.SERVICE_UNAVAILABLE, 'SERVICE_UNAVAILABLE'],
  ])('derives a stable code from the status of framework exceptions (%#)', async (exception, status, code) => {
    await filter.catch(exception, createHost(captured));

    expect(captured.status).toBe(status);
    expect(captured.body.code).toBe(code);
  });

  it('never exposes the internal message of a server error', async () => {
    await filter.catch(new InvariantViolationException('db password is hunter2'), createHost(captured));
    await filter.catch(new Error('connect ECONNREFUSED 10.0.0.5:5432'), createHost(captured));

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body).toMatchObject({ code: 'INTERNAL_ERROR', message: 'Internal server error' });
    expect(JSON.stringify(captured.body)).not.toContain('10.0.0.5');
  });
});
