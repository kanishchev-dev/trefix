/**
 * Event emitted when user permissions or groups are modified.
 */
export class UserPermissionsUpdatedEvent {
  constructor(
    public readonly userId: string,
    public readonly action: 'assign_group' | 'revoke_group' | 'assign_permission' | 'revoke_permission',
    public readonly targetId: string,
  ) {}
}
