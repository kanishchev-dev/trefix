/**
 * App logger. Debug output (request traces, state transitions) stays in
 * development builds: production device logs must not carry URLs, ids or
 * response bodies.
 */
export const logger = {
  debug(message: string, ...details: unknown[]): void {
    if (__DEV__) {
      console.log(message, ...details);
    }
  },
  warn(message: string, ...details: unknown[]): void {
    if (__DEV__) {
      console.warn(message, ...details);
    }
  },
  /** Errors keep their message in production; details only in development. */
  error(message: string, ...details: unknown[]): void {
    if (__DEV__) {
      console.error(message, ...details);
    } else {
      console.error(message);
    }
  },
};
