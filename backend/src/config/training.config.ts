import { registerAs } from '@nestjs/config';

import { PLAN_CREATE_RATE_LIMIT_DEFAULT, PLANS_PER_ATHLETE_LIMIT } from '@/modules/training/training.constants';

/**
 * Training feature limits. Kept in config so they can be tuned per
 * environment without a release.
 */
export default registerAs('training', () => ({
  /** Maximum number of plans per athlete across all statuses. */
  plansPerAthleteLimit: parseInt(process.env.TRAINING_PLANS_PER_ATHLETE_LIMIT || String(PLANS_PER_ATHLETE_LIMIT), 10),
  /** Hourly limit of plan creations per user. */
  planCreateRateLimit: parseInt(
    process.env.TRAINING_PLAN_CREATE_RATE_LIMIT || String(PLAN_CREATE_RATE_LIMIT_DEFAULT),
    10,
  ),
}));
