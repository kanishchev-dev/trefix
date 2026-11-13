/**
 * Event emitted when a permission is deleted.
 */
export class PermissionDeletedEvent {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}
