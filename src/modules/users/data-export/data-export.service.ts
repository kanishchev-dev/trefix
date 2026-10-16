import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Queue } from 'bullmq';
import { createHash, randomBytes } from 'crypto';
import { Readable } from 'stream';
import { ZipFile } from 'yazl';

import { DomainException } from '@/common/exceptions/domain.exception';
import { DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { MailerService } from '@/modules/mailer/mailer.service';
import { StorageService } from '@/modules/storage/storage.service';
import { USERS_EVENTS } from '@/modules/users/users.events';

import { UsersService } from '../users.service';
import { DataExportCollector } from './data-export.collector';
import {
  DATA_EXPORT_BUILD_JOB,
  DATA_EXPORT_COOLDOWN_MS,
  DATA_EXPORT_EXPIRE_JOB,
  DATA_EXPORT_LINK_TTL_MS,
  DATA_EXPORT_QUEUE,
  DATA_EXPORT_TEMPLATE,
  type DataExportJobData,
} from './data-export.constants';
import { DataExportResponseDto } from './data-export.dto';
import { DataExport } from './data-export.entity';
import { DataExportReadyEvent, DataExportRequestedEvent } from './data-export.events';

const sha256 = (value: string): string => createHash('sha256').update(value).digest('hex');

/**
 * Personal data export: the request is accepted at once, the archive is built
 * in the background and the user gets an emailed link valid for a week.
 */
@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    @InjectModel(DataExport)
    private readonly exportModel: typeof DataExport,
    @InjectQueue(DATA_EXPORT_QUEUE)
    private readonly queue: Queue<DataExportJobData>,
    private readonly collector: DataExportCollector,
    private readonly usersService: UsersService,
    private readonly storageService: StorageService,
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** The latest request, or null; the app shows whether a new one is possible. */
  async latest(userId: string): Promise<DataExportResponseDto | null> {
    const latest = await this.findLatest(userId);
    return latest ? this.toResponse(latest) : null;
  }

  async request(userId: string, now = new Date()): Promise<DataExportResponseDto> {
    const latest = await this.findLatest(userId);
    if (latest && now.getTime() - latest.createdAt.getTime() < DATA_EXPORT_COOLDOWN_MS) {
      throw new DomainException(
        'DATA_EXPORT_RATE_LIMITED',
        'A data export can be requested once a day',
        HttpStatus.TOO_MANY_REQUESTS,
        {
          availableAt: new Date(latest.createdAt.getTime() + DATA_EXPORT_COOLDOWN_MS).toISOString(),
        },
      );
    }
    const created = await this.exportModel.create({ userId, status: 'pending' });
    await this.queue.add(
      DATA_EXPORT_BUILD_JOB,
      { exportId: created.id },
      { jobId: `data-export:${created.id}`, attempts: 3, backoff: { type: 'exponential', delay: 30_000 } },
    );
    this.eventEmitter.emit(USERS_EVENTS.DATA_EXPORT_REQUESTED, new DataExportRequestedEvent(userId, created.id));
    return this.toResponse(created);
  }

  /** Builds the archive, stores it and emails the link. Repeated runs for a ready export do nothing. */
  async build(exportId: string): Promise<void> {
    const record = await this.exportModel.findByPk(exportId);
    if (!record || record.status !== 'pending') {
      return;
    }
    const user = await this.usersService.findOne(record.userId);
    const sections = await this.collector.collect(record.userId);
    const tracks = await this.openTracks(record.userId);
    const buffer = await this.zip(sections, tracks);
    const stamp = record.createdAt.toISOString().slice(0, 10);
    const file = await this.storageService.uploadFile(
      { originalname: `trefix-data-${stamp}.zip`, mimetype: 'application/zip', size: buffer.length, buffer },
      { uploaderUserId: record.userId, folder: 'data-exports' },
    );

    const token = randomBytes(32).toString('base64url');
    const readyAt = new Date();
    record.set({
      status: 'ready',
      fileId: file.id,
      downloadTokenHash: sha256(token),
      readyAt,
      expiresAt: new Date(readyAt.getTime() + DATA_EXPORT_LINK_TTL_MS),
      error: null,
    });
    await record.save();
    await this.queue.add(
      DATA_EXPORT_EXPIRE_JOB,
      { exportId: record.id },
      { jobId: `data-export-expire:${record.id}`, delay: DATA_EXPORT_LINK_TTL_MS },
    );

    const apiBaseUrl = this.configService.getOrThrow<string>('app.apiBaseUrl');
    await this.mailerService.send({
      to: user.email,
      subject: 'Your Trefix data is ready',
      template: DATA_EXPORT_TEMPLATE,
      data: {
        url: `${apiBaseUrl}/v1/data-exports/${record.id}/download?token=${token}`,
        expiresInDays: Math.round(DATA_EXPORT_LINK_TTL_MS / (24 * 60 * 60 * 1000)),
      },
    });
    this.eventEmitter.emit(USERS_EVENTS.DATA_EXPORT_READY, new DataExportReadyEvent(record.userId, record.id));
  }

  /** Called when the last attempt failed, so the user is not left with an endless "preparing". */
  async markFailed(exportId: string, reason: string): Promise<void> {
    await this.exportModel.update(
      { status: 'failed', error: reason.slice(0, 255) },
      { where: { id: exportId, status: 'pending' } },
    );
  }

  async expire(exportId: string): Promise<void> {
    const record = await this.exportModel.findByPk(exportId);
    if (!record || record.status !== 'ready') {
      return;
    }
    if (record.fileId) {
      await this.storageService.deleteFileQuietly(record.fileId);
    }
    record.set({ status: 'expired', fileId: null, downloadTokenHash: null });
    await record.save();
  }

  /** Stream of the archive for a valid link; any mismatch looks the same as a missing export. */
  async openDownload(exportId: string, token: string): Promise<{ stream: Readable; fileName: string }> {
    const record = await this.exportModel.findByPk(exportId);
    const valid =
      record?.status === 'ready' &&
      record.fileId &&
      record.downloadTokenHash === sha256(token) &&
      (!record.expiresAt || record.expiresAt.getTime() > Date.now());
    if (!record || !valid || !record.fileId) {
      throw new DomainNotFoundException('DATA_EXPORT_NOT_FOUND', 'The link is invalid or has expired');
    }
    const { file, stream } = await this.storageService.getFile(record.fileId, { requesterUserId: record.userId });
    return { stream, fileName: file.originalName };
  }

  /** Every export of the user, newest first, for the admin panel. */
  async listForUser(userId: string): Promise<DataExportResponseDto[]> {
    const records = await this.exportModel.findAll({ where: { userId }, order: [['createdAt', 'DESC']] });
    return records.map((record) => this.toResponse(record));
  }

  /** The archive of a ready export of this user, without the emailed token; for administrators. */
  async openForAdmin(userId: string, exportId: string): Promise<{ stream: Readable; fileName: string }> {
    const record = await this.exportModel.findOne({ where: { id: exportId, userId } });
    if (!record || record.status !== 'ready' || !record.fileId) {
      throw new DomainNotFoundException('DATA_EXPORT_NOT_FOUND', 'The export is not available');
    }
    const { file, stream } = await this.storageService.getFile(record.fileId, { requesterUserId: record.userId });
    return { stream, fileName: file.originalName };
  }

  private findLatest(userId: string): Promise<DataExport | null> {
    return this.exportModel.findOne({ where: { userId }, order: [['createdAt', 'DESC']] });
  }

  /** A track that cannot be read is left out rather than failing the whole export. */
  private async openTracks(userId: string): Promise<Array<{ name: string; stream: Readable }>> {
    const tracks: Array<{ name: string; stream: Readable }> = [];
    for (const fileId of await this.collector.trackFileIds(userId)) {
      try {
        const { file, stream } = await this.storageService.getFile(fileId, { requesterUserId: userId });
        tracks.push({ name: `tracks/${fileId}-${file.originalName}`, stream });
      } catch (error) {
        this.logger.warn(`Track ${fileId} skipped in data export: ${(error as Error).message}`);
      }
    }
    return tracks;
  }

  private zip(sections: Record<string, unknown[]>, tracks: Array<{ name: string; stream: Readable }>): Promise<Buffer> {
    const zip = new ZipFile();
    for (const [name, rows] of Object.entries(sections)) {
      zip.addBuffer(Buffer.from(JSON.stringify(rows, null, 2)), `${name}.json`);
    }
    for (const track of tracks) {
      zip.addReadStream(track.stream, track.name);
    }
    zip.end();
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      zip.outputStream.on('data', (chunk: Buffer) => chunks.push(chunk));
      zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)));
      zip.outputStream.on('error', reject);
    });
  }

  private toResponse(record: DataExport): DataExportResponseDto {
    return {
      id: record.id,
      status: record.status,
      requestedAt: record.createdAt,
      readyAt: record.readyAt,
      expiresAt: record.expiresAt,
      nextAvailableAt: new Date(record.createdAt.getTime() + DATA_EXPORT_COOLDOWN_MS),
    };
  }
}
