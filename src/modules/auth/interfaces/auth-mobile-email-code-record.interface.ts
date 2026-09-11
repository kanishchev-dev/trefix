import { AuthCodeRecord } from './auth-code-record.interface';

export interface AuthMobileEmailCodeRecord extends AuthCodeRecord {
  email: string;
}
