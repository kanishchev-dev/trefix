import { CoachPolicyService, quietHoursEnd } from './coach-policy.service';
import type { UserPreferencesService } from './user-preferences.service';

describe('CoachPolicyService', () => {
  const build = (preferences: Record<string, unknown>): CoachPolicyService =>
    new CoachPolicyService({
      getEntity: jest.fn().mockResolvedValue({
        coachEnabled: true,
        coachAdaptationMode: 'confirm',
        coachQuietHours: null,
        timezone: null,
        ...preferences,
      }),
    } as unknown as UserPreferencesService);

  it('maps adaptation modes to policies', async () => {
    await expect(build({ coachAdaptationMode: 'auto' }).automaticAdaptationPolicy('u')).resolves.toBe('apply');
    await expect(build({ coachAdaptationMode: 'confirm' }).automaticAdaptationPolicy('u')).resolves.toBe('propose');
    await expect(build({ coachAdaptationMode: 'suggest' }).automaticAdaptationPolicy('u')).resolves.toBe('suggest');
    await expect(build({ coachEnabled: false }).automaticAdaptationPolicy('u')).resolves.toBe('skip');
  });

  it('rejects coach requests when the coach is off', async () => {
    await expect(build({ coachEnabled: false }).assertEnabled('u')).rejects.toMatchObject({ code: 'COACH_DISABLED' });
    await expect(build({}).assertEnabled('u')).resolves.toBeUndefined();
  });

  it('holds proactive messages during quiet hours', async () => {
    const service = build({ coachQuietHours: { from: '22:00', to: '08:00' }, timezone: 'UTC' });
    const night = await service.proactiveMessageWindow('u', new Date('2026-10-09T23:30:00Z'));
    expect(night.allowed).toBe(false);
    expect(night.resumeAt?.toISOString()).toBe('2026-10-10T08:00:00.000Z');
    const day = await service.proactiveMessageWindow('u', new Date('2026-10-09T12:00:00Z'));
    expect(day).toEqual({ allowed: true, resumeAt: null });
  });
});

describe('quietHoursEnd', () => {
  it('handles intervals within one day and the time zone', () => {
    const quiet = { from: '13:00', to: '15:00' };
    expect(quietHoursEnd(quiet, 'Europe/Moscow', new Date('2026-10-09T10:30:00Z'))?.toISOString()).toBe(
      '2026-10-09T12:00:00.000Z',
    );
    expect(quietHoursEnd(quiet, 'Europe/Moscow', new Date('2026-10-09T13:30:00Z'))).toBeNull();
    expect(quietHoursEnd(null, 'UTC', new Date())).toBeNull();
  });
});
