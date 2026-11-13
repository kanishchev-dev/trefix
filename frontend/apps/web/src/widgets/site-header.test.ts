import { describe, expect, it } from "vitest";

import { resolveBreadcrumbs } from "./site-header";

describe("resolveBreadcrumbs", () => {
  it("resolves dashboard root path", () => {
    expect(resolveBreadcrumbs("/dashboard")).toEqual([
      { key: "breadcrumbs.dashboard" },
    ]);
  });

  it("resolves profile path", () => {
    expect(resolveBreadcrumbs("/profile")).toEqual([
      { key: "breadcrumbs.profile" },
    ]);
  });

  it("resolves settings root path", () => {
    expect(resolveBreadcrumbs("/settings")).toEqual([
      { key: "breadcrumbs.settings" },
    ]);
  });

  it("resolves settings authentication subpath without leading dashboard", () => {
    expect(resolveBreadcrumbs("/settings/authentication")).toEqual([
      { key: "breadcrumbs.settings", href: "/settings" },
      { key: "breadcrumbs.authentication" },
    ]);
  });

  it("resolves users list path", () => {
    expect(resolveBreadcrumbs("/users/list")).toEqual([
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.list" },
    ]);
  });

  it("resolves user creation path", () => {
    expect(resolveBreadcrumbs("/users/create")).toEqual([
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.create" },
    ]);
  });

  it("resolves user edit path", () => {
    expect(resolveBreadcrumbs("/users/123/edit")).toEqual([
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.edit" },
    ]);
  });

  it("resolves groups list path", () => {
    expect(resolveBreadcrumbs("/users/groups")).toEqual([
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.groups", href: "/users/groups" },
    ]);
  });

  it("resolves group creation path", () => {
    expect(resolveBreadcrumbs("/users/groups/create")).toEqual([
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.groups", href: "/users/groups" },
      { key: "breadcrumbs.create" },
    ]);
  });

  it("resolves group edit path", () => {
    expect(resolveBreadcrumbs("/users/groups/456/edit")).toEqual([
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.groups", href: "/users/groups" },
      { key: "breadcrumbs.edit" },
    ]);
  });

  it("resolves a user plan path", () => {
    expect(resolveBreadcrumbs("/users/u1/plans/p1")).toEqual([
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.user", href: "/users/u1" },
      { key: "breadcrumbs.plans", href: "/users/u1/plans" },
      { key: "breadcrumbs.plan" },
    ]);
  });

  it("resolves plan creation and rebuild paths", () => {
    expect(resolveBreadcrumbs("/users/u1/plans/create").at(-1)).toEqual({
      key: "breadcrumbs.createPlan",
    });
    expect(resolveBreadcrumbs("/users/u1/plans/p1/rebuild").slice(-2)).toEqual([
      { key: "breadcrumbs.plan", href: "/users/u1/plans/p1" },
      { key: "breadcrumbs.rebuild" },
    ]);
  });

  it("resolves sections of a user's card", () => {
    expect(resolveBreadcrumbs("/users/u1")).toEqual([
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.user" },
    ]);
    expect(resolveBreadcrumbs("/users/u1/account")).toEqual([
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.user", href: "/users/u1" },
      { key: "userCard.sections.account.title" },
    ]);
    expect(resolveBreadcrumbs("/users/u1/workouts/w1").slice(-2)).toEqual([
      {
        key: "userCard.sections.calendar.title",
        href: "/users/u1/calendar",
      },
      { key: "breadcrumbs.workout" },
    ]);
  });

  it("resolves the audit log", () => {
    expect(resolveBreadcrumbs("/audit")).toEqual([
      { key: "breadcrumbs.audit" },
    ]);
  });

  it("resolves the notifications page and a notification", () => {
    expect(resolveBreadcrumbs("/notifications")).toEqual([
      { key: "breadcrumbs.notifications" },
    ]);
    expect(resolveBreadcrumbs("/notifications/abc")).toEqual([
      { key: "breadcrumbs.notifications", href: "/notifications" },
      { key: "breadcrumbs.notification" },
    ]);
  });
});
