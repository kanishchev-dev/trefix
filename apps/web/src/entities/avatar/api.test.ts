import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiClientError } from "@workspace/api-client";

import { avatarPaths, uploadOwnAvatar, uploadUserAvatar } from "./api";

type FetchArgs = [input: RequestInfo | URL, init?: RequestInit];

const USER_ID = "11111111-1111-4111-8111-111111111111";

function mockFetch(response: Response): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (...args: FetchArgs) => {
    void args;
    return response;
  });

  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function blob(): Blob {
  return new Blob(["image-bytes"], { type: "image/webp" });
}

describe("avatarPaths", () => {
  it("addresses the own account through the self-service route", () => {
    expect(avatarPaths.own).toBe("/api/admin/avatars/me");
  });

  it("addresses another user through the admin route", () => {
    expect(avatarPaths.forUser(USER_ID)).toBe(`/api/admin/avatars/${USER_ID}`);
  });
});

describe("avatar upload", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /**
   * The two routes exist because they need different permissions: `me` takes
   * `account.update`, the addressable one takes `users.update`.
   */
  it("posts the own avatar to the self-service route", async () => {
    const fetchMock = mockFetch(jsonResponse({ avatarUrl: "https://api/me.png" }));

    await expect(uploadOwnAvatar(blob())).resolves.toEqual({
      avatarUrl: "https://api/me.png",
    });

    const [path, init] = fetchMock.mock.calls[0] as FetchArgs;
    expect(path).toBe("/api/admin/avatars/me");
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeInstanceOf(FormData);
    expect(init?.credentials).toBe("include");
  });

  it("never sets a content-type, which would corrupt the multipart boundary", async () => {
    const fetchMock = mockFetch(jsonResponse({ avatarUrl: "https://api/me.png" }));

    await uploadOwnAvatar(blob());

    const [, init] = fetchMock.mock.calls[0] as FetchArgs;
    const headers = new Headers(init?.headers);
    expect(headers.get("content-type")).toBeNull();
  });

  it("posts the avatar of another user to the admin route", async () => {
    const fetchMock = mockFetch(
      jsonResponse({ avatarUrl: "https://api/other.png" }),
    );

    await expect(uploadUserAvatar(USER_ID, blob())).resolves.toEqual({
      avatarUrl: "https://api/other.png",
    });

    const [path] = fetchMock.mock.calls[0] as FetchArgs;
    expect(path).toBe(`/api/admin/avatars/${USER_ID}`);
  });

  it("reports the backend error code and message", async () => {
    mockFetch(
      jsonResponse({ code: "AVATAR_INVALID_FILE", message: "Unsupported type" }, 400),
    );

    await expect(uploadOwnAvatar(blob())).rejects.toMatchObject({
      status: 400,
      code: "AVATAR_INVALID_FILE",
      message: "Unsupported type",
    });
  });

  it("falls back to the status when the body carries no message", async () => {
    mockFetch(new Response(null, { status: 500 }));

    const error = await uploadOwnAvatar(blob()).catch((thrown) => thrown);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error.message).toContain("500");
  });
});