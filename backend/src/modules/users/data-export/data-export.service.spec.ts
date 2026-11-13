import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Queue } from 'bullmq';
import { createHash } from 'crypto';

import { MailerService } from '@/modules/mailer/mailer.service';
import { StorageService } from '@/modules/storage/storage.service';

import { UsersService } from '../users.service';
import { DataExportCollector } from './data-export.collector';
import { DataExportJobData } from './data-export.constants';
import { DataExport } from './data-export.entity';
import { DataExportService } from './data-export.service';

describe('DataExportService', () => {
  const now = new Date('2026-10-15T12:00:00.000Z');
  let exportModel: { findOne: jest.Mock; findByPk: jest.Mock; create: jest.Mock; update: jest.Mock };
  let queue: { add: jest.Mock };
  let storage: { uploadFile: jest.Mock; getFile: jest.Mock; deleteFileQuietly: jest.Mock };
  let mailer: { send: jest.Mock };
  let service: DataExportService;

  beforeEach(() => {
    exportModel = { findOne: jest.fn(), findByPk: jest.fn(), create: jest.fn(), update: jest.fn() };
    queue = { add: jest.fn() };
    storage = {
      uploadFile: jest.fn().mockResolvedValue({ id: 'file-1' }),
      getFile: jest.fn(),
      deleteFileQuietly: jest.fn(),
    };
    mailer = { send: jest.fn() };
    service = new DataExportService(
      exportModel as unknown as typeof DataExport,
      queue as unknown as Queue<DataExportJobData>,
      {
        collect: jest.fn().mockResolvedValue({ account: [{ id: 'user-1' }] }),
        trackFileIds: jest.fn().mockResolvedValue([]),
      } as unknown as DataExportCollector,
      { findOne: jest.fn().mockResolvedValue({ email: 'runner@example.com' }) } as unknown as UsersService,
      storage as unknown as StorageService,
      mailer as unknown as MailerService,
      { getOrThrow: jest.fn().mockReturnValue('https://api.trefix.app') } as unknown as ConfigService,
      { emit: jest.fn() } as unknown as EventEmitter2,
    );
  });

  it('allows one request a day', async () => {
    exportModel.findOne.mockResolvedValue({ createdAt: new Date('2026-10-15T02:00:00.000Z') });

    await expect(service.request('user-1', now)).rejects.toMatchObject({
      code: 'DATA_EXPORT_RATE_LIMITED',
      details: { availableAt: '2026-10-16T02:00:00.000Z' },
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues the build when the last request is older than a day', async () => {
    exportModel.findOne.mockResolvedValue({ createdAt: new Date('2026-10-14T11:00:00.000Z') });
    exportModel.create.mockResolvedValue({
      id: 'export-1',
      status: 'pending',
      createdAt: now,
      readyAt: null,
      expiresAt: null,
    });

    await service.request('user-1', now);

    expect(queue.add).toHaveBeenCalledWith('data-export.build', { exportId: 'export-1' }, expect.any(Object));
  });

  it('builds the archive and emails a link whose token opens it', async () => {
    const record = {
      id: 'export-1',
      userId: 'user-1',
      status: 'pending',
      createdAt: now,
      set(values: Record<string, unknown>): void {
        Object.assign(this, values);
      },
      save: jest.fn(),
    };
    exportModel.findByPk.mockResolvedValue(record);

    await service.build('export-1');

    expect(storage.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ mimetype: 'application/zip', originalname: 'trefix-data-2026-10-15.zip' }),
      { uploaderUserId: 'user-1', folder: 'data-exports' },
    );
    const url = (mailer.send.mock.calls[0][0] as { data: { url: string } }).data.url;
    const token = new URL(url).searchParams.get('token')!;
    expect(record).toMatchObject({
      status: 'ready',
      downloadTokenHash: createHash('sha256').update(token).digest('hex'),
    });

    storage.getFile.mockResolvedValue({ file: { originalName: 'trefix-data-2026-10-15.zip' }, stream: {} });
    await expect(service.openDownload('export-1', token)).resolves.toMatchObject({
      fileName: 'trefix-data-2026-10-15.zip',
    });
    await expect(service.openDownload('export-1', 'wrong')).rejects.toMatchObject({ code: 'DATA_EXPORT_NOT_FOUND' });
  });
});
