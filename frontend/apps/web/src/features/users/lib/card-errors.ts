import { ApiClientError } from "@trefix/api-client";

/** Athlete-keyed endpoints answer 404 while the user has no athlete profile. */
export const isNotFound = (error: unknown): boolean =>
  error instanceof ApiClientError && error.status === 404;
