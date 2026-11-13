export const ACTIVITY_EVENTS = {
  DATA_ACCESSED: 'admin.data_accessed',
} as const;

/** Sensitive user data an administrator opened in the admin panel. */
export type DataAccessResource = 'coach.conversation' | 'workout.recording' | 'user.data_export' | 'activity.export';

export class DataAccessedEvent {
  constructor(
    public readonly subjectUserId: string | null,
    public readonly resource: DataAccessResource,
    public readonly resourceId: string | null,
  ) {}
}
