import { describe, expect, it } from "vitest";

import {
  USER_SECTIONS,
  canSeeSection,
  legacyTabSection,
  resolveUserSection,
  userSectionHref,
} from "./user-sections";

describe("user sections", () => {
  it("builds section links", () => {
    expect(userSectionHref("u1", "overview")).toBe("/users/u1");
    expect(userSectionHref("u1", "account")).toBe("/users/u1/account");
  });

  it("resolves the section of a path", () => {
    expect(resolveUserSection("/users/u1")).toBe("overview");
    expect(resolveUserSection("/users/u1/plans/p1")).toBe("plans");
    expect(resolveUserSection("/users/u1/workouts/w1")).toBe("calendar");
    expect(resolveUserSection("/users/u1/unknown")).toBe("overview");
  });

  it("maps legacy tabs to sections", () => {
    expect(legacyTabSection("training")).toBe("calendar");
    expect(legacyTabSection("plans")).toBe("plans");
    expect(legacyTabSection("nope")).toBeNull();
    expect(legacyTabSection(null)).toBeNull();
  });

  it("hides sections without their permission", () => {
    const coach = USER_SECTIONS.find((section) => section.key === "coach");
    const profile = USER_SECTIONS.find((section) => section.key === "profile");
    expect(coach && canSeeSection(coach, () => false)).toBe(false);
    expect(coach && canSeeSection(coach, (p) => p === "coach.users.read")).toBe(
      true,
    );
    expect(profile && canSeeSection(profile, () => false)).toBe(true);
  });
});
