/**
 * Body handling for the API proxies in `src/app/api/*`.
 *
 * The proxies used to parse every request body as JSON, which silently dropped
 * anything else: a multipart upload arrived at the backend with no file at all.
 * `prepareProxyBody` keeps JSON handling as is and streams binary bodies through
 * with their original content type.
 */

export type ProxyPayload =
  | { kind: "json"; body: string }
  | { kind: "stream"; body: ReadableStream<Uint8Array>; contentType: string }
  | { kind: "empty" };

/** Content types that must not be parsed or re-encoded. */
const PASSTHROUGH_CONTENT_TYPES = ["multipart/form-data", "application/octet-stream"];

export function isPassthroughContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();

  return PASSTHROUGH_CONTENT_TYPES.some((type) => normalized.includes(type));
}

export async function prepareProxyBody(
  request: Request,
  method: string,
): Promise<ProxyPayload> {
  if (method === "GET" || method === "HEAD") {
    return { kind: "empty" };
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (isPassthroughContentType(contentType)) {
    if (!request.body) {
      return { kind: "empty" };
    }

    return {
      kind: "stream",
      // The stream is handed over as-is: re-encoding a multipart body would
      // corrupt the boundary and drop the file part.
      body: request.body as ReadableStream<Uint8Array>,
      contentType,
    };
  }

  if (!contentType.includes("application/json")) {
    return { kind: "empty" };
  }

  const parsed = await request.json().catch(() => undefined);

  return parsed === undefined
    ? { kind: "empty" }
    : { kind: "json", body: JSON.stringify(parsed) };
}

/**
 * Builds the `fetch` init for a payload.
 *
 * `duplex: "half"` is required by undici whenever the body is a stream; it is
 * not part of the DOM `RequestInit` type yet.
 */
export function payloadToFetchInit(payload: ProxyPayload): {
  body?: BodyInit;
  headers: Record<string, string>;
  duplex?: "half";
} {
  if (payload.kind === "json") {
    return { body: payload.body, headers: { "content-type": "application/json" } };
  }

  if (payload.kind === "stream") {
    return {
      body: payload.body,
      headers: { "content-type": payload.contentType },
      duplex: "half",
    };
  }

  return { headers: { "content-type": "application/json" } };
}
