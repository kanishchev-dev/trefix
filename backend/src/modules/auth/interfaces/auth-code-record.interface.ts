export interface AuthCodeRecord {
  codeHash: string;
  attempts: number;
  createdAt: string;
  expiresAt: string;
}
