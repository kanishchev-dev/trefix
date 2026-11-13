/**
 * Emitted when an invited user completes activation by setting a password.
 * Lets the admin UI refresh the user record without a manual reload.
 */
export class UserActivatedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}
