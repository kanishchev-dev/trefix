import { QueryClient } from "@tanstack/react-query";
import type {
  AdminUser,
  AdminUserDetail,
  PaginatedResponse,
} from "@trefix/api-client";
import { describe, expect, it } from "vitest";

import {
  applyRealtimeEventToCache,
  mergeUpdatedUser,
  realtimeEventData,
} from "./realtime-sync";

const USER_ID = "user-1";

function makeUser(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: USER_ID,
    email: "old@example.com",
    firstName: "Old",
    lastName: "Name",
    avatarUrl: null,
    referralCode: null,
    emailVerified: true,
    emailVerifiedAt: null,
    isSystem: false,
    systemKey: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    passwordChangedAt: null,
    ...overrides,
  };
}

function makeList(users: AdminUser[]): PaginatedResponse<AdminUser> {
  return {
    data: users,
    meta: {
      page: 1,
      limit: 20,
      total: users.length,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  };
}

function envelope(data: unknown): unknown {
  return {
    event: "user.updated",
    data,
    meta: {
      emittedAt: "2024-01-01T00:00:00.000Z",
      audience: "room",
      target: "users",
    },
  };
}

describe("realtimeEventData", () => {
  it("unwraps the realtime envelope", () => {
    expect(realtimeEventData(envelope({ userId: USER_ID }))).toEqual({
      userId: USER_ID,
    });
  });

  it("tolerates a bare payload", () => {
    expect(realtimeEventData({ userId: USER_ID })).toEqual({ userId: USER_ID });
  });

  it("returns null for anything that is not an object", () => {
    expect(realtimeEventData(null)).toBeNull();
    expect(realtimeEventData("user.updated")).toBeNull();
  });
});

describe("mergeUpdatedUser", () => {
  it("patches the cached detail record without touching unrelated fields", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["users", "detail", USER_ID], {
      ...makeUser(),
      groups: [],
      individualPermissions: [],
      effectivePermissions: [],
    } satisfies AdminUserDetail);

    const merged = mergeUpdatedUser(
      queryClient,
      envelope({ userId: USER_ID, firstName: "New", lastName: "Name" }),
    );

    expect(merged).toBe(true);

    const detail = queryClient.getQueryData<AdminUserDetail>([
      "users",
      "detail",
      USER_ID,
    ]);

    expect(detail?.firstName).toBe("New");
    expect(detail?.email).toBe("old@example.com");
    expect(detail?.effectivePermissions).toEqual([]);
  });

  it("updates the matching row of a cached list and leaves the rest alone", () => {
    const queryClient = new QueryClient();
    const other = makeUser({ id: "user-2", firstName: "Other" });

    queryClient.setQueryData(
      ["users", "list", { page: 1 }],
      makeList([makeUser(), other]),
    );

    mergeUpdatedUser(
      queryClient,
      envelope({ userId: USER_ID, firstName: "Renamed" }),
    );

    const cached = queryClient.getQueryData<PaginatedResponse<AdminUser>>([
      "users",
      "list",
      { page: 1 },
    ]);

    expect(cached?.data.map((user) => user.firstName)).toEqual([
      "Renamed",
      "Other",
    ]);
  });

  it("never invents a field the event did not carry", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["users", "detail", USER_ID], {
      ...makeUser({ avatarUrl: "https://cdn.example.com/a.png" }),
      groups: [],
      individualPermissions: [],
      effectivePermissions: [],
    } satisfies AdminUserDetail);

    mergeUpdatedUser(
      queryClient,
      envelope({ userId: USER_ID, firstName: "Renamed" }),
    );

    const detail = queryClient.getQueryData<AdminUserDetail>([
      "users",
      "detail",
      USER_ID,
    ]);

    expect(detail?.avatarUrl).toBe("https://cdn.example.com/a.png");
  });

  it("clears the avatar when the event explicitly says it is gone", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["users", "detail", USER_ID], {
      ...makeUser({ avatarUrl: "https://cdn.example.com/a.png" }),
      groups: [],
      individualPermissions: [],
      effectivePermissions: [],
    } satisfies AdminUserDetail);

    mergeUpdatedUser(
      queryClient,
      envelope({ userId: USER_ID, avatarUrl: null }),
    );

    expect(
      queryClient.getQueryData<AdminUserDetail>(["users", "detail", USER_ID])
        ?.avatarUrl,
    ).toBeNull();
  });

  it("reports no merge when the user is not on screen", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(
      ["users", "list", { page: 1 }],
      makeList([makeUser({ id: "user-2" })]),
    );

    expect(
      mergeUpdatedUser(
        queryClient,
        envelope({ userId: USER_ID, firstName: "Renamed" }),
      ),
    ).toBe(false);
  });

  it("ignores a payload without a user id instead of guessing", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["users", "detail", USER_ID], {
      ...makeUser(),
      groups: [],
      individualPermissions: [],
      effectivePermissions: [],
    } satisfies AdminUserDetail);

    expect(
      mergeUpdatedUser(queryClient, envelope({ firstName: "Renamed" })),
    ).toBe(false);
    expect(
      queryClient.getQueryData<AdminUserDetail>(["users", "detail", USER_ID])
        ?.firstName,
    ).toBe("Old");
  });
});

describe("applyRealtimeEventToCache", () => {
  it("routes a known event to its merge", () => {
    const queryClient = new QueryClient();
    queryClient.setQueryData(["users", "detail", USER_ID], {
      ...makeUser(),
      groups: [],
      individualPermissions: [],
      effectivePermissions: [],
    } satisfies AdminUserDetail);

    expect(
      applyRealtimeEventToCache(
        queryClient,
        "user.updated",
        envelope({ userId: USER_ID, firstName: "Renamed" }),
      ),
    ).toBe(true);
  });

  it("leaves events without a merge rule to invalidation alone", () => {
    const queryClient = new QueryClient();

    expect(
      applyRealtimeEventToCache(
        queryClient,
        "user.created",
        envelope({ userId: USER_ID }),
      ),
    ).toBe(false);
  });
});
