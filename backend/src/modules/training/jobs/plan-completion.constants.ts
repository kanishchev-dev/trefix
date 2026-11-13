/** Queue name of the daily plan auto-completion job. */
export const PLAN_COMPLETION_QUEUE = 'plan-completion';

/** Job payload; empty because the job scans all ended active plans. */
export interface PlanCompletionJobData {
  triggeredBy: 'schedule';
}
