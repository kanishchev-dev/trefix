import type { FieldChanges } from '@/common/utils/field-changes.util';

export class PreferencesUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly changedFields: string[],
    /** Before and after values of `changedFields`. */
    public readonly changes: FieldChanges | null = null,
  ) {}
}
