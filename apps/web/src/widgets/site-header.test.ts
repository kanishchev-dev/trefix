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
});
