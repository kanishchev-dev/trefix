import type { EventEmitter2 } from '@nestjs/event-emitter';

import { HEALTH_CONSENT_CURRENT_VERSION } from './consents.constants';
import type { UserConsent } from './user-consent.entity';
import { UserConsentsService } from './user-consents.service';

describe('UserConsentsService', () => {
  let model: { findOne: jest.Mock; create: jest.Mock; update: jest.Mock };
  let events: { emit: jest.Mock; emitAsync: jest.Mock };
  let service: UserConsentsService;

  const record = (overrides: Partial<UserConsent> = {}): UserConsent =>
    ({
      type: 'health_data',
      version: HEALTH_CONSENT_CURRENT_VERSION,
      acceptedAt: new Date('2026-10-09T10:00:00Z'),
      revokedAt: null,
      ...overrides,
    }) as UserConsent;

  beforeEach(() => {
    model = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async (values) => record(values)),
      update: jest.fn().mockResolvedValue([1]),
    };
    events = { emit: jest.fn(), emitAsync: jest.fn() };
    service = new UserConsentsService(model as unknown as typeof UserConsent, events as unknown as EventEmitter2);
  });

  it('records the current version and announces it', async () => {
    const result = await service.give('user-1', {
      type: 'health_data',
      version: HEALTH_CONSENT_CURRENT_VERSION,
      client: { platform: 'ios' },
    });
    expect(result).toMatchObject({ type: 'health_data', isCurrent: true, revokedAt: null });
    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', client: { platform: 'ios' } }),
    );
    expect(events.emit).toHaveBeenCalledWith('users.consent_given', expect.any(Object));
  });

  it('refuses an outdated text version', async () => {
    await expect(service.give('user-1', { type: 'health_data', version: '2020-01' })).rejects.toMatchObject({
      code: 'CONSENT_VERSION_OUTDATED',
    });
  });

  it('does not duplicate an active consent', async () => {
    model.findOne.mockResolvedValue(record());
    await service.give('user-1', { type: 'health_data', version: HEALTH_CONSENT_CURRENT_VERSION });
    expect(model.create).not.toHaveBeenCalled();
  });

  it('treats revoked and outdated consents as missing', async () => {
    model.findOne.mockResolvedValueOnce(record({ revokedAt: new Date() }));
    expect(await service.hasCurrent('user-1', 'health_data')).toBe(false);
    model.findOne.mockResolvedValueOnce(record({ version: '2020-01' }));
    await expect(service.assertCurrent('user-1', 'health_data')).rejects.toMatchObject({
      code: 'HEALTH_CONSENT_REQUIRED',
    });
  });

  it('awaits listeners on revoke and is a no-op without an active consent', async () => {
    await service.revoke('user-1', 'health_data');
    expect(events.emitAsync).toHaveBeenCalledWith(
      'users.consent_revoked',
      expect.objectContaining({ userId: 'user-1' }),
    );
    model.update.mockResolvedValue([0]);
    events.emitAsync.mockClear();
    await service.revoke('user-1', 'health_data');
    expect(events.emitAsync).not.toHaveBeenCalled();
  });
});
