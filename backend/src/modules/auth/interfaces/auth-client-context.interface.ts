/** Where a sign-in comes from; stored on the session so the user can recognise their devices. */
export interface AuthClientContext {
  userAgent?: string;
  ipAddress?: string;
  /** Device model reported by the app, e.g. `iPhone 15 Pro`. */
  deviceName?: string;
  /** `ios`, `android` or `web`. */
  platform?: string;
  appVersion?: string;
}
