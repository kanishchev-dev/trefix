/**
 * Event emitted when a new permission group is created.
 */
export class PermissionGroupCreatedEvent {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}
