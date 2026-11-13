/**
 * Event emitted when a new permission is created.
 */
export class PermissionCreatedEvent {
  constructor(
    public readonly id: string,
    public readonly name: string,
  ) {}
}
