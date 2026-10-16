import type { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';
import type { PlanQueryService } from '@/modules/training/plans/plan-query.service';
import type { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';
import type { UsersService } from '@/modules/users/users.service';

import type { PushDevicesService } from '../push/push-devices.service';
import { AudienceResolverService } from './audience-resolver.service';

describe('AudienceResolverService', () => {
  const users = { findActiveRecipientIds: jest.fn() };
  const permissions = { findGroupMemberIds: jest.fn() };
  const preferences = { filterByLanguage: jest.fn() };
  const plans = { findUserIdsWithActivePlan: jest.fn() };
  const devices = { usersByPlatforms: jest.fn() };
  const resolver = new AudienceResolverService(
    users as unknown as UsersService,
    permissions as unknown as UserPermissionsService,
    preferences as unknown as UserPreferencesService,
    plans as unknown as PlanQueryService,
    devices as unknown as PushDevicesService,
  );

  beforeEach(() => jest.resetAllMocks());

  it('limits a group to its active members', async () => {
    permissions.findGroupMemberIds.mockResolvedValue(['u1', 'u2']);
    users.findActiveRecipientIds.mockResolvedValue(['u1']);

    await expect(resolver.resolve({ type: 'group', groupId: 'g1' })).resolves.toEqual(['u1']);
    expect(users.findActiveRecipientIds).toHaveBeenCalledWith({ ids: ['u1', 'u2'] });
  });

  it('applies every segment filter and includes the whole last registration day', async () => {
    users.findActiveRecipientIds.mockResolvedValue(['u1', 'u2', 'u3', 'u4']);
    preferences.filterByLanguage.mockResolvedValue(['u1', 'u2', 'u3']);
    devices.usersByPlatforms.mockResolvedValue(new Set(['u1', 'u2']));
    plans.findUserIdsWithActivePlan.mockResolvedValue(new Set(['u2']));

    const ids = await resolver.resolve({
      type: 'segment',
      segment: {
        languages: ['ru'],
        platforms: ['ios'],
        registeredFrom: '2026-09-01',
        registeredTo: '2026-09-30',
        activePlan: false,
      },
    });

    expect(ids).toEqual(['u1']);
    expect(users.findActiveRecipientIds).toHaveBeenCalledWith({
      registeredFrom: new Date('2026-09-01T00:00:00.000Z'),
      registeredTo: new Date('2026-09-30T23:59:59.999Z'),
    });
    expect(preferences.filterByLanguage).toHaveBeenCalledWith(['u1', 'u2', 'u3', 'u4'], ['ru'], 'ru');
  });
});
