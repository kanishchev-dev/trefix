import { AuthCodeRecord } from './auth-code-record.interface';

/** A pending email change: the code was sent to `email`, which becomes the account email once confirmed. */
export interface AuthEmailChangeRecord extends AuthCodeRecord {
  email: string;
}
