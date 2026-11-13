import trainingConfig from '@/config/training.config';

import { PLAN_CREATE_RATE_TTL_MS } from '../training.constants';

/**
 * Per-user hourly limit of plan creations (create, rebuild, start). The
 * limit is read from the training config on every request, and requests are
 * tracked by user id so users behind one IP do not share the budget.
 */
export const PLAN_CREATE_THROTTLE = {
  default: {
    limit: (): number => trainingConfig().planCreateRateLimit,
    ttl: PLAN_CREATE_RATE_TTL_MS,
    getTracker: (request: Record<string, unknown>): string => {
      const user = request.user as { id?: string } | undefined;
      return user?.id ?? String(request.ip ?? 'anonymous');
    },
  },
};
