/** What an administrator did to a user's training plan. */
export type AdminPlanAction =
  | 'created'
  | 'meta_updated'
  | 'structure_updated'
  | 'changes_applied'
  | 'started'
  | 'cancelled'
  | 'deleted'
  | 'rebuilt';

/**
 * Audit trail of plan changes made from the admin panel. The domain events of
 * the plan itself (`training.plan.*`) do not carry the actor, so this event
 * records who acted on whose plan.
 */
export class AdminPlanActionEvent {
  constructor(
    public readonly actorUserId: string,
    public readonly userId: string,
    public readonly planId: string,
    public readonly action: AdminPlanAction,
  ) {}
}
