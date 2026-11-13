import { describe, expect, it } from "vitest";

import type { Notification } from "@trefix/api-client";

import { groupByDay } from "./inbox-groups";

const item = (id: string, createdAt: string): Notification => ({
  id,
  category: "admin",
  type: "admin.message",
  title: null,
  body: "Text",
  params: {},
  link: null,
  readAt: null,
  createdAt,
});

describe("groupByDay", () => {
  it("names today and yesterday and keeps older days by date", () => {
    const now = new Date(2026, 9, 16, 12, 0);
    const groups = groupByDay(
      [
        item("a", new Date(2026, 9, 16, 9, 0).toISOString()),
        item("b", new Date(2026, 9, 16, 8, 0).toISOString()),
        item("c", new Date(2026, 9, 15, 20, 0).toISOString()),
        item("d", new Date(2026, 9, 10, 7, 0).toISOString()),
      ],
      now,
    );
    expect(
      groups.map((group) => [group.key, group.items.map((entry) => entry.id)]),
    ).toEqual([
      ["today", ["a", "b"]],
      ["yesterday", ["c"]],
      ["2026-10-10", ["d"]],
    ]);
  });
});
