import { Injectable } from '@nestjs/common';

import { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';
import { PlanQueryService } from '@/modules/training/plans/plan-query.service';
import { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';
import { UsersService } from '@/modules/users/users.service';

import { type BroadcastAudience, NOTIFICATIONS_FALLBACK_LANGUAGE } from '../notifications.constants';
import { PushDevicesService } from '../push/push-devices.service';

/** End of the day of an ISO date, so `registeredTo` includes the whole day. */
function endOfDay(date: string): Date {
  const end = new Date(`${date.slice(0, 10)}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return new Date(end.getTime() - 1);
}

/**
 * Turns a broadcast audience into user ids. Every audience is limited to
 * active accounts: deleted, blocked and system users never receive broadcasts.
 */
@Injectable()
export class AudienceResolverService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userPermissionsService: UserPermissionsService,
    private readonly preferencesService: UserPreferencesService,
    private readonly planQueryService: PlanQueryService,
    private readonly devicesService: PushDevicesService,
  ) {}

  async resolve(audience: BroadcastAudience): Promise<string[]> {
    switch (audience.type) {
      case 'users':
        return this.usersService.findActiveRecipientIds({ ids: audience.userIds ?? [] });
      case 'group': {
        const members = await this.userPermissionsService.findGroupMemberIds(audience.groupId ?? '');
        return members.length > 0 ? this.usersService.findActiveRecipientIds({ ids: members }) : [];
      }
      case 'all':
        return this.usersService.findActiveRecipientIds();
      case 'segment':
        return this.resolveSegment(audience);
    }
  }

  private async resolveSegment(audience: BroadcastAudience): Promise<string[]> {
    const segment = audience.segment ?? {};
    let ids = await this.usersService.findActiveRecipientIds({
      registeredFrom: segment.registeredFrom
        ? new Date(`${segment.registeredFrom.slice(0, 10)}T00:00:00.000Z`)
        : undefined,
      registeredTo: segment.registeredTo ? endOfDay(segment.registeredTo) : undefined,
    });
    if (segment.languages?.length) {
      ids = await this.preferencesService.filterByLanguage(ids, segment.languages, NOTIFICATIONS_FALLBACK_LANGUAGE);
    }
    if (segment.platforms?.length) {
      const withPlatform = await this.devicesService.usersByPlatforms(segment.platforms);
      ids = ids.filter((id) => withPlatform.has(id));
    }
    if (segment.activePlan !== undefined) {
      const withPlan = await this.planQueryService.findUserIdsWithActivePlan();
      ids = ids.filter((id) => withPlan.has(id) === segment.activePlan);
    }
    return ids;
  }
}
