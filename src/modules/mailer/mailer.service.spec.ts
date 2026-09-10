import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';

import { MAILER_QUEUE_NAME, MAILER_TRANSPORT } from './mailer.constants';
import { MailerService } from './mailer.service';
import { MailerComposerService } from './services/mailer-composer.service';

describe('MailerService', () => {
  let service: MailerService;

  const preparedMessage = {
    to: ['user@example.com'],
    subject: 'Welcome',
    html: '<p>Hello</p>',
    text: 'Hello',
    from: 'Application <no-reply@example.com>',
    template: 'users/welcome',
    attachments: [],
  };

  const composerService = {
    compose: jest.fn().mockResolvedValue(preparedMessage),
  };

  const transport = {
    send: jest.fn().mockResolvedValue({
      messageId: '<message-id@example.com>',
      accepted: ['user@example.com'],
      rejected: [],
      response: '250 OK',
    }),
  };

  const queue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  } as unknown as Queue;

  const configService = {
    get: jest.fn().mockImplementation((key: string) => {
      if (key === 'mailer.fromName') {
        return 'Application';
      }

      if (key === 'mailer.allowFromOverride') {
        return false;
      }

      if (key === 'mailer.useQueue') {
        return false;
      }

      return undefined;
    }),
    getOrThrow: jest.fn().mockReturnValue('no-reply@example.com'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        {
          provide: ConfigService,
          useValue: configService,
        },
        {
          provide: MailerComposerService,
          useValue: composerService,
        },
        {
          provide: MAILER_TRANSPORT,
          useValue: transport,
        },
        {
          provide: getQueueToken(MAILER_QUEUE_NAME),
          useValue: queue,
        },
      ],
    }).compile();

    service = module.get<MailerService>(MailerService);
  });

  it('sends email directly when queueing is disabled', async () => {
    const result = await service.send({
      to: 'user@example.com',
      subject: 'Welcome',
      template: 'users/welcome',
      data: {},
    });

    expect(composerService.compose).toHaveBeenCalled();
    expect(transport.send).toHaveBeenCalledWith(preparedMessage);
    expect(queue.add).not.toHaveBeenCalled();
    expect(result).toEqual({
      queued: false,
      messageId: '<message-id@example.com>',
      accepted: ['user@example.com'],
      rejected: [],
      response: '250 OK',
    });
  });

  it('queues the prepared message when queueing is enabled', async () => {
    configService.get.mockImplementation((key: string) => {
      if (key === 'mailer.fromName') {
        return 'Application';
      }

      if (key === 'mailer.allowFromOverride') {
        return false;
      }

      if (key === 'mailer.useQueue') {
        return true;
      }

      return undefined;
    });

    const result = await service.send({
      to: 'user@example.com',
      subject: 'Welcome',
      template: 'users/welcome',
      data: {},
    });

    expect(transport.send).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(
      'send-mail',
      preparedMessage,
      expect.objectContaining({
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
      }),
    );
    expect(result).toEqual({
      queued: true,
      jobId: 'job-1',
    });
  });
});
