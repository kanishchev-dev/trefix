import { describe, expect, it } from "vitest";

import type { ActivityItem } from "@trefix/api-client";

import {
  describeActivity,
  describeActor,
  entityHref,
  formatChangeValue,
} from "./activity-texts";

const DICTIONARY: Record<string, string> = {
  "activity.actions.training_workout_updated": "Workout changed",
  "activity.actions.admin_data_accessed": "Viewed {resource}",
  "activity.resources.coach_conversation": "a coach conversation",
  "activity.actors.admin": "Admin",
  "activity.actors.user": "User",
  "common.yes": "Yes",
  "common.no": "No",
};

const t = (key: string, params?: Record<string, string | number>): string => {
  const value = DICTIONARY[key] ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    String(params?.[name] ?? ""),
  );
};

function item(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    id: "a1",
    occurredAt: "2026-10-16T10:00:00.000Z",
    action: "training.workout.updated",
    domain: "workouts",
    actor: { type: "user", id: "u1", name: null },
    subject: { id: "u1", name: "Anna" },
    entity: { type: "workout", id: "w1" },
    changes: null,
    metadata: {},
    source: "mobile",
    client: null,
    ip: null,
    ...overrides,
  };
}

describe("activity texts", () => {
  it("describes known actions and falls back to the code", () => {
    expect(describeActivity(item(), t)).toBe("Workout changed");
    expect(describeActivity(item({ action: "custom.thing" }), t)).toBe(
      "custom.thing",
    );
  });

  it("names the resource an admin viewed", () => {
    const access = item({
      action: "admin.data_accessed",
      metadata: { resource: "coach.conversation" },
    });
    expect(describeActivity(access, t)).toBe("Viewed a coach conversation");
  });

  it("names the admin behind an action", () => {
    expect(
      describeActor(
        item({ actor: { type: "admin", id: "a", name: "Ivan" } }),
        t,
      ),
    ).toBe("Admin · Ivan");
    expect(describeActor(item(), t)).toBe("User");
  });

  it("links workouts and plans to their pages", () => {
    expect(entityHref(item())).toBe("/users/u1/workouts/w1");
    expect(entityHref(item({ entity: { type: "plan", id: "p1" } }))).toBe(
      "/users/u1/plans/p1",
    );
    expect(entityHref(item({ entity: { type: "gear", id: "g1" } }))).toBeNull();
  });

  it("formats changed values", () => {
    expect(formatChangeValue(null, t)).toBe("—");
    expect(formatChangeValue(true, t)).toBe("Yes");
    expect(formatChangeValue(["mon", "wed"], t)).toBe("mon, wed");
    expect(formatChangeValue({ a: 1 }, t)).toBe('{"a":1}');
  });
});
