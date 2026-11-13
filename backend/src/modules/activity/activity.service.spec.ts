import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Op } from 'sequelize';

import { getActivityContext } from '@/common/context/activity-context';
import { RedisService } from '@/common/redis/redis.service';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { UsersService } from '@/modules/users/users.service';

import { ActivityService } from './activity.service';
import { decodeActivityCursor } from './activity-cursor';
import type { ActivityWriteJobData } from './activity-record.builder';
import { ActivityEvent } from './entities/activity-event.entity';
import { ACTIVITY_EVENTS, DataAccessedEvent } from './events/activity.events';

const record = (overrides: Partial<ActivityWriteJobData> = {}): ActivityWriteJobData => ({
  occurredAt: '2026-10-16T09:00:00.000Z',
  action: 'training.workout.updated',
  domain: 'workouts',
  subject: { athleteId: 'athlete-1' },
  actorType: 'admin',
  actorUserId: 'admin-1',
  entityType: 'workout',
  entityId: 'w-1',
  changes: { distanceKm: { from: 8, to: 9 } },
  metadata: {},
  source: 'admin',
  client: null,
  ip: null,
  traceId: 't-1',
  ...overrides,
});

const row = (id: string, occurredAt: string, overrides: Partial<ActivityEvent> = {}): ActivityEvent =>
  ({
    id,
    occurredAt: new Date(occurredAt),
    subjectUserId: 'user-1',
    actorType: 'admin',
    actorUserId: 'admin-1',
    action: 'training.workout.updated',
    domain: 'workouts',
    entityType: 'workout',
    entityId: 'w-1',
    changes: null,
    metadata: {},
    source: 'admin',
    client: null,
    ip: null,
    ...overrides,
  }) as ActivityEvent;

describe('ActivityService', () => {
  let service: ActivityService;
  const model = { create: jest.fn(), findAll: jest.fn(), destroy: jest.fn() };
  const athletes = { findById: jest.fn() };
  const users = { findDisplayNames: jest.fn() };
  const redis = { set: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    jest.resetAllMocks();
    users.findDisplayNames.mockResolvedValue(
      new Map([
        ['admin-1', 'Viktor K.'],
        ['user-1', 'Anna S.'],
      ]),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        ActivityService,
        { provide: getModelToken(ActivityEvent), useValue: model },
        { provide: AthletesService, useValue: athletes },
        { provide: UsersService, useValue: users },
        { provide: RedisService, useValue: { getOrThrow: (): typeof redis => redis } },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: ConfigService, useValue: { getOrThrow: (): number => 730 } },
      ],
    }).compile();

    service = moduleRef.get(ActivityService);
  });

  describe('write', () => {
    it('resolves the athlete to the user whose history it is', async () => {
      athletes.findById.mockResolvedValue({ id: 'athlete-1', userId: 'user-1' });

      await service.write(record());

      expect(model.create).toHaveBeenCalledWith(
        expect.objectContaining({
          subjectUserId: 'user-1',
          actorType: 'admin',
          actorUserId: 'admin-1',
          occurredAt: new Date('2026-10-16T09:00:00.000Z'),
          changes: { distanceKm: { from: 8, to: 9 } },
        }),
      );
    });

    it('drops an entry of an athlete that no longer exists', async () => {
      athletes.findById.mockResolvedValue(null);

      await service.write(record());

      expect(model.create).not.toHaveBeenCalled();
    });

    it('writes system-wide entries without a subject', async () => {
      await service.write(record({ subject: null, domain: 'settings' }));

      expect(model.create).toHaveBeenCalledWith(expect.objectContaining({ subjectUserId: null }));
      expect(athletes.findById).not.toHaveBeenCalled();
    });
  });

  describe('list', () => {
    it('returns a page with names and a cursor to the next one', async () => {
      model.findAll.mockResolvedValue([
        row('0199b0c4-0000-7000-8000-000000000003', '2026-10-16T09:00:00.000Z'),
        row('0199b0c4-0000-7000-8000-000000000002', '2026-10-15T09:00:00.000Z'),
        row('0199b0c4-0000-7000-8000-000000000001', '2026-10-14T09:00:00.000Z'),
      ]);

      const page = await service.list({ subjectUserId: 'user-1' }, undefined, 2);

      expect(model.findAll).toHaveBeenCalledWith(expect.objectContaining({ limit: 3 }));
      expect(page.items).toHaveLength(2);
      expect(page.items[0].actor).toEqual({ type: 'admin', id: 'admin-1', name: 'Viktor K.' });
      expect(page.items[0].subject).toEqual({ id: 'user-1', name: 'Anna S.' });
      expect(page.hasNext).toBe(true);
      expect(decodeActivityCursor(page.nextCursor!)).toEqual({
        occurredAt: new Date('2026-10-15T09:00:00.000Z'),
        id: '0199b0c4-0000-7000-8000-000000000002',
      });
    });

    it('has no next page after the last entry', async () => {
      model.findAll.mockResolvedValue([row('0199b0c4-0000-7000-8000-000000000001', '2026-10-14T09:00:00.000Z')]);

      const page = await service.list({ subjectUserId: 'user-1' }, undefined, 2);

      expect(page).toMatchObject({ hasNext: false, nextCursor: null });
    });

    it('limits the global log to admin actions by kind', async () => {
      model.findAll.mockResolvedValue([]);

      await service.list({ kind: 'admin' }, undefined, 10);

      const where = model.findAll.mock.calls[0][0].where;
      expect(where[Op.and]).toContainEqual({ actorType: 'admin' });
    });
  });

  it('keeps admin actions and data access past retention', async () => {
    await service.removeExpired(new Date('2026-10-16T00:00:00.000Z'));

    expect(model.destroy).toHaveBeenCalledWith({
      where: {
        occurredAt: { [Op.lt]: new Date('2024-10-16T00:00:00.000Z') },
        actorType: { [Op.ne]: 'admin' },
        domain: { [Op.ne]: 'data_access' },
      },
    });
  });

  describe('recordDataAccess', () => {
    const access = {
      actorUserId: 'admin-1',
      subjectUserId: 'user-1',
      resource: 'coach.conversation' as const,
      resourceId: 's-1',
    };

    it('emits the access on behalf of the administrator', async () => {
      redis.set.mockResolvedValue('OK');
      let actor: unknown;
      eventEmitter.emit.mockImplementation(() => {
        actor = getActivityContext();
      });

      await service.recordDataAccess(access);

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        ACTIVITY_EVENTS.DATA_ACCESSED,
        new DataAccessedEvent('user-1', 'coach.conversation', 's-1'),
      );
      expect(actor).toMatchObject({ actorType: 'admin', actorUserId: 'admin-1', source: 'admin' });
    });

    it('records repeated views of the same resource once', async () => {
      redis.set.mockResolvedValue(null);

      await service.recordDataAccess(access);

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });
});
