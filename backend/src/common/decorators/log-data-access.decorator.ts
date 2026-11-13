import { SetMetadata } from '@nestjs/common';

export const LOG_DATA_ACCESS_KEY = 'activity:logDataAccess';

export interface LogDataAccessOptions {
  /** Kind of sensitive data the endpoint returns. */
  resource: 'coach.conversation' | 'workout.recording' | 'user.data_export';
  /** Route param holding the owner of the data. */
  subjectParam?: string;
  /** Route param holding the id of the opened resource. */
  resourceParam?: string;
}

/**
 * Records in the owner's activity history that an administrator opened their
 * sensitive data. Written only after the handler succeeds.
 */
export const LogDataAccess = (options: LogDataAccessOptions): ReturnType<typeof SetMetadata> =>
  SetMetadata(LOG_DATA_ACCESS_KEY, { subjectParam: 'userId', ...options });
