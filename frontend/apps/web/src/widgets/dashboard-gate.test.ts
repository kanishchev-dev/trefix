import { describe, expect, it } from "vitest";

import { requiredPermission } from "./dashboard-gate";

describe("requiredPermission", () => {
  it.each([
    ["/users/list", "users.read"],
    ["/users/u1", "users.read"],
    ["/users/u1/plans/p1", "training.userplans.read"],
    ["/users/u1/plans/create", "training.userplans.manage"],
    ["/users/u1/plans/p1/rebuild", "training.userplans.manage"],
    ["/users/u1/account", "users.security.read"],
    ["/users/u1/history", "users.activity.read"],
    ["/users/u1/coach", "coach.users.read"],
    ["/users/u1/workouts/w1", "training.calendar.read"],
    ["/users/u1/profile", "users.read"],
    ["/audit", "audit.read"],
    ["/profile", "account.update"],
  ])("guards %s with %s", (pathname, permission) => {
    expect(requiredPermission(pathname)).toBe(permission);
  });

  it("leaves unknown sections open", () => {
    expect(requiredPermission("/dashboard")).toBeNull();
  });
});
