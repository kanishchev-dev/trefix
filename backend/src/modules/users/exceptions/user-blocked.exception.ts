import { ForbiddenActionException } from '@/common/exceptions/domain-exceptions';

/** The account is blocked by an administrator; clients show the block screen by this code. */
export class UserBlockedException extends ForbiddenActionException {
  constructor(until: Date | null) {
    super('USER_BLOCKED', 'The account is blocked', until ? { until: until.toISOString() } : undefined);
  }
}
