import { ApiClientError, type ApiErrorShape } from "@workspace/api-client";
import { loadAuthSession } from "./auth-session";

const BACKEND_BASE_URL =
  process.env.EXPO_PUBLIC_BACKEND_URL ||
  process.env.EXPO_PUBLIC_AUTH_BACKEND_URL ||
  "http://127.0.0.1:3000/v1";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  useAuth?: boolean;
};

export async function request<TResponse>(
  path: string,
  options?: RequestOptions,
): Promise<TResponse> {
  const url = `${BACKEND_BASE_URL}${path}`;
  console.log(`[API] Fetching: ${options?.method ?? "GET"} ${url}`);

  const headers: Record<string, string> = {
    "content-type": "application/json",
  };

  if (options?.useAuth) {
    const session = await loadAuthSession();
    if (session?.accessToken) {
      headers["Authorization"] = `Bearer ${session.accessToken}`;
    } else {
      console.warn(`[API] No token found for authenticated request: ${path}`);
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const response = await fetch(url, {
      method: options?.method ?? "GET",
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log(`[API] Response status: ${response.status}`);

    if (!response.ok) {
      const errorBody = (await response
        .json()
        .catch(() => null)) as ApiErrorShape | null;
      throw new ApiClientError(
        errorBody?.message ?? `Request failed with status ${response.status}`,
        response.status,
        errorBody?.code,
        errorBody,
      );
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  } catch (error) {
    console.error(`[API] Request error:`, error);
    throw error;
  }
}
