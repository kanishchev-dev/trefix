export class UserInvitedEvent {
  constructor(
    public readonly userId: string,
    public readonly email: string,
  ) {}
}
