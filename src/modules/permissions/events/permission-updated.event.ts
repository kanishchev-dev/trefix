/**
 * Event emitted when a permission is updated.
 */
export class PermissionUpdatedEvent {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}
