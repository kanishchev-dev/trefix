import { DefaultJobOptions } from 'bullmq';

/**
 * Retry policy applied to every queue unless a job sets its own.
 *
 * BullMQ defaults to a single attempt and keeps finished jobs forever; both are
 * wrong for production. Failed jobs are kept longer than completed ones so they
 * can be inspected after the `failed` alert.
 */
export const DEFAULT_QUEUE_JOB_OPTIONS: DefaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { count: 1000 },
  removeOnFail: { count: 5000 },
};
