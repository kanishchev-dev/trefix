import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@workspace/api-client";

import { apiRequest as request } from "./api";

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];

function mockFetch(response: Response): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (...args: FetchArgs) => {
      void args;
      return response;
    }),
  );
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses a JSON body", async () => {
    mockFetch(jsonResponse({ id: "1" }));

    await expect(request<{ id: string }>("/api/admin/users")).resolves.toEqual({
      id: "1",
    });
  });

  it("returns undefined for 204 No Content", async () => {
    mockFetch(new Response(null, { status: 204 }));

    await expect(
      request<void>("/api/admin/users/1", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });

  /**
   * Endpoints that only mutate state may answer 200/201 with no body. Parsing
   * those as JSON threw "Unexpected end of JSON input" right after a request
   * that had actually succeeded.
   */
  it.each([200, 201])(
    "treats an empty %i response as no data",
    async (status) => {
      mockFetch(new Response("", { status }));

      await expect(
        request<void>("/api/admin/users/1/permissions/2", { method: "POST" }),
      ).resolves.toBeUndefined();
    },
  );

  it("throws an ApiClientError with the backend code on failure", async () => {
    mockFetch(
      jsonResponse({ message: "Not found", code: "PERMISSION_NOT_FOUND" }, 404),
    );

    await expect(request("/api/admin/users/1")).rejects.toBeInstanceOf(
      ApiClientError,
    );
  });

  it("survives an error response without a JSON body", async () => {
    mockFetch(new Response("upstream is down", { status: 502 }));

    await expect(request("/api/admin/users")).rejects.toThrow(
      /Request failed with status 502/,
    );
  });
});
