/**
 * Event emitted when a permission group is deleted.
 */
export class PermissionGroupDeletedEvent {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}
