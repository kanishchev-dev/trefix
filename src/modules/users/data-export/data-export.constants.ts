export const DATA_EXPORT_QUEUE = 'data-export';
export const DATA_EXPORT_BUILD_JOB = 'data-export.build';
export const DATA_EXPORT_EXPIRE_JOB = 'data-export.expire';
/** One export per day: building it reads every table of the user. */
export const DATA_EXPORT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
export const DATA_EXPORT_LINK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const DATA_EXPORT_TEMPLATE = 'users/data-export-ready';
export const DATA_EXPORT_STATUSES = ['pending', 'ready', 'failed', 'expired'] as const;
export type DataExportStatus = (typeof DATA_EXPORT_STATUSES)[number];

export interface DataExportJobData {
  exportId: string;
}
