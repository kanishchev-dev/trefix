import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, type WhereOptions } from 'sequelize';

import { runWithActivityContext } from '@/common/context/activity-context';
import { RedisService } from '@/common/redis/redis.service';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { UsersService } from '@/modules/users/users.service';

import {
  ACTIVITY_EXPORT_BATCH_SIZE,
  ACTIVITY_EXPORT_ROW_LIMIT,
  ACTIVITY_PAGE_LIMIT_DEFAULT,
  DATA_ACCESS_DEDUP_TTL_SECONDS,
} from './activity.constants';
import { decodeActivityCursor, encodeActivityCursor } from './activity-cursor';
import type { ActivityWriteJobData } from './activity-record.builder';
import type { ActivityFilterDto, ActivityLogKind } from './dto/activity-query.dto';
import type { ActivityItemDto, ActivityPageDto } from './dto/activity-response.dto';
import { ActivityEvent } from './entities/activity-event.entity';
import { ACTIVITY_EVENTS, DataAccessedEvent, type DataAccessResource } from './events/activity.events';

/** Filters after resolving the endpoint: the scope of one user or of the global log. */
export interface ActivitySearch extends ActivityFilterDto {
  subjectUserId?: string;
  actorUserId?: string;
  kind?: ActivityLogKind;
}

export interface DataAccessRecord {
  actorUserId: string;
  subjectUserId: string | null;
  resource: DataAccessResource | 'activity.export';
  resourceId: string | null;
}

@Injectable()
export class ActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    @InjectModel(ActivityEvent)
    private readonly activityModel: typeof ActivityEvent,
    private readonly athletesService: AthletesService,
    private readonly usersService: UsersService,
    private readonly redisService: RedisService,
    private readonly eventEmitter: EventEmitter2,
    private readonly configService: ConfigService,
  ) {}

  // ------------------------------------------------------------------ writing

  /** Persists a captured event; entries of an athlete that no longer exists are dropped. */
  async write(record: ActivityWriteJobData): Promise<void> {
    let subjectUserId: string | null = null;
    if (record.subject && 'userId' in record.subject) {
      subjectUserId = record.subject.userId;
    } else if (record.subject && 'athleteId' in record.subject) {
      const athlete = await this.athletesService.findById(record.subject.athleteId);
      if (!athlete) {
        this.logger.debug(`Skipping activity ${record.action}: athlete ${record.subject.athleteId} is gone`);
        return;
      }
      subjectUserId = athlete.userId;
    }

    await this.activityModel.create({
      occurredAt: new Date(record.occurredAt),
      subjectUserId,
      actorType: record.actorType,
      actorUserId: record.actorUserId,
      action: record.action,
      domain: record.domain,
      entityType: record.entityType,
      entityId: record.entityId,
      changes: record.changes,
      metadata: record.metadata,
      source: record.source,
      client: record.client,
      ip: record.ip,
      traceId: record.traceId,
    });
  }

  /**
   * Records that an administrator opened sensitive data of a user. Repeated
   * views of the same resource within a short window are recorded once.
   */
  async recordDataAccess(access: DataAccessRecord): Promise<void> {
    try {
      const key = `activity:data-access:${access.actorUserId}:${access.resource}:${access.resourceId ?? access.subjectUserId ?? '-'}`;
      const fresh = await this.redisService.getOrThrow().set(key, '1', 'EX', DATA_ACCESS_DEDUP_TTL_SECONDS, 'NX');
      if (fresh !== 'OK') {
        return;
      }
      runWithActivityContext({ actorType: 'admin', actorUserId: access.actorUserId, source: 'admin' }, () => {
        this.eventEmitter.emit(
          ACTIVITY_EVENTS.DATA_ACCESSED,
          new DataAccessedEvent(access.subjectUserId, access.resource, access.resourceId),
        );
      });
    } catch (error) {
      this.logger.error(`Cannot record data access to ${access.resource}: ${(error as Error).message}`);
    }
  }

  /** Erases the whole history of a purged account. */
  async eraseSubject(userId: string): Promise<number> {
    return this.activityModel.destroy({ where: { subjectUserId: userId } });
  }

  /** Removes ordinary entries past retention; admin actions and data access are kept. */
  async removeExpired(now: Date): Promise<number> {
    const days = this.configService.getOrThrow<number>('activity.retentionDays');
    const threshold = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    return this.activityModel.destroy({
      where: {
        occurredAt: { [Op.lt]: threshold },
        actorType: { [Op.ne]: 'admin' },
        domain: { [Op.ne]: 'data_access' },
      },
    });
  }

  // ------------------------------------------------------------------ reading

  async list(search: ActivitySearch, cursor: string | undefined, limit?: number): Promise<ActivityPageDto> {
    const pageSize = limit ?? ACTIVITY_PAGE_LIMIT_DEFAULT;
    const rows = await this.find(search, cursor, pageSize + 1);
    const hasNext = rows.length > pageSize;
    const page = hasNext ? rows.slice(0, pageSize) : rows;
    const last = page.at(-1);
    return {
      items: await this.toItems(page),
      nextCursor: hasNext && last ? encodeActivityCursor({ occurredAt: last.occurredAt, id: last.id }) : null,
      hasNext,
    };
  }

  /** Pages through the matching entries for a CSV export, newest first, up to the export limit. */
  async *iterate(search: ActivitySearch): AsyncGenerator<ActivityItemDto[]> {
    let cursor: string | undefined;
    let emitted = 0;
    while (emitted < ACTIVITY_EXPORT_ROW_LIMIT) {
      const size = Math.min(ACTIVITY_EXPORT_BATCH_SIZE, ACTIVITY_EXPORT_ROW_LIMIT - emitted);
      const rows = await this.find(search, cursor, size);
      if (rows.length === 0) {
        return;
      }
      emitted += rows.length;
      yield await this.toItems(rows);
      const last = rows[rows.length - 1];
      cursor = encodeActivityCursor({ occurredAt: last.occurredAt, id: last.id });
      if (rows.length < size) {
        return;
      }
    }
  }

  private find(search: ActivitySearch, cursor: string | undefined, limit: number): Promise<ActivityEvent[]> {
    return this.activityModel.findAll({
      where: this.buildWhere(search, cursor),
      order: [
        ['occurredAt', 'DESC'],
        ['id', 'DESC'],
      ],
      limit,
    });
  }

  private buildWhere(search: ActivitySearch, cursor: string | undefined): WhereOptions<ActivityEvent> {
    const conditions: WhereOptions<ActivityEvent>[] = [];

    if (search.subjectUserId) {
      conditions.push({ subjectUserId: search.subjectUserId });
    }
    if (search.actorUserId) {
      conditions.push({ actorUserId: search.actorUserId });
    }
    if (search.kind === 'admin') {
      conditions.push({ actorType: 'admin' });
    } else if (search.kind === 'data_access') {
      conditions.push({ domain: 'data_access' });
    }
    if (search.domain?.length) {
      conditions.push({ domain: { [Op.in]: search.domain } });
    }
    if (search.actorType?.length) {
      conditions.push({ actorType: { [Op.in]: search.actorType } });
    }
    if (search.from) {
      conditions.push({ occurredAt: { [Op.gte]: new Date(search.from) } });
    }
    if (search.to) {
      conditions.push({ occurredAt: { [Op.lt]: new Date(search.to) } });
    }
    if (search.entityType) {
      conditions.push({ entityType: search.entityType });
    }
    if (search.entityId) {
      conditions.push({ entityId: search.entityId });
    }
    if (search.q) {
      const pattern = `%${search.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
      conditions.push({ [Op.or]: [{ action: { [Op.iLike]: pattern } }, { entityId: search.q }] });
    }
    if (cursor) {
      const { occurredAt, id } = decodeActivityCursor(cursor);
      conditions.push({
        [Op.or]: [{ occurredAt: { [Op.lt]: occurredAt } }, { occurredAt, id: { [Op.lt]: id } }],
      });
    }

    return conditions.length > 0 ? { [Op.and]: conditions } : {};
  }

  private async toItems(rows: ActivityEvent[]): Promise<ActivityItemDto[]> {
    const names = await this.usersService.findDisplayNames(
      rows.flatMap((row) => [row.actorUserId, row.subjectUserId]).filter((id): id is string => Boolean(id)),
    );
    return rows.map((row) => ({
      id: row.id,
      occurredAt: row.occurredAt.toISOString(),
      action: row.action,
      domain: row.domain,
      actor: {
        type: row.actorType,
        id: row.actorUserId,
        name: row.actorUserId ? (names.get(row.actorUserId) ?? null) : null,
      },
      subject: row.subjectUserId ? { id: row.subjectUserId, name: names.get(row.subjectUserId) ?? null } : null,
      entity: row.entityType ? { type: row.entityType, id: row.entityId } : null,
      changes: row.changes,
      metadata: row.metadata ?? {},
      source: row.source,
      client: row.client,
      ip: row.ip,
    }));
  }
}
