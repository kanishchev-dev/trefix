import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { ApiClientError } from "@workspace/api-client";

const DEFAULT_STALE_TIME_MS = 5 * 60 * 1000;

/**
 * The app's query client. A 401 that survived the client's own token refresh
 * means the session is gone, so every query and mutation reports it.
 */
export function createQueryClient(onUnauthorized: () => void): QueryClient {
  const reportUnauthorized = (error: unknown) => {
    if (error instanceof ApiClientError && error.status === 401) {
      onUnauthorized();
    }
  };

  return new QueryClient({
    queryCache: new QueryCache({ onError: reportUnauthorized }),
    mutationCache: new MutationCache({ onError: reportUnauthorized }),
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: DEFAULT_STALE_TIME_MS,
      },
    },
  });
}
