/**
 * Event emitted when a permission group changes.
 */
export class PermissionGroupUpdatedEvent {
  constructor(
    public readonly groupId: string,
    public readonly name: string,
    public readonly action: 'updated' | 'permission_added' | 'permission_removed',
    public readonly targetId?: string,
  ) {}
}
