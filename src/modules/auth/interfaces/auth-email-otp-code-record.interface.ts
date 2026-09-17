import { AuthCodeRecord } from './auth-code-record.interface';

export interface AuthEmailOtpCodeRecord extends AuthCodeRecord {
  email: string;
}
