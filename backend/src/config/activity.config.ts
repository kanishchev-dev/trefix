import { registerAs } from '@nestjs/config';

import { ACTIVITY_RETENTION_DAYS_DEFAULT } from '@/modules/activity/activity.constants';

export default registerAs('activity', () => ({
  /** Days ordinary activity entries are kept; admin actions and data access are kept forever. */
  retentionDays: parseInt(process.env.ACTIVITY_RETENTION_DAYS || String(ACTIVITY_RETENTION_DAYS_DEFAULT), 10),
}));
