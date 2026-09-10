export interface SmtpResponse {
  readonly code: number;
  readonly message: string;
  readonly lines: string[];
}
