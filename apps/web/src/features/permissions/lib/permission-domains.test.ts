import { describe, expect, it } from "vitest";

import {
  UNGROUPED_MODULE,
  UNGROUPED_RESOURCE,
  groupPermissionsByModule,
  splitPermissionName,
} from "./permission-domains";

describe("splitPermissionName", () => {
  it("splits a two segment name into module and action", () => {
    expect(splitPermissionName("users.create")).toEqual({
      module: "users",
      resource: UNGROUPED_RESOURCE,
      action: "create",
    });
  });

  it("keeps the resource of a three segment name", () => {
    expect(splitPermissionName("training.plans.update")).toEqual({
      module: "training",
      resource: "plans",
      action: "update",
    });
  });

  it("treats the last segment as the action of a deeper name", () => {
    expect(splitPermissionName("users.groups.assign")).toEqual({
      module: "users",
      resource: "groups",
      action: "assign",
    });
  });

  it("treats a name without a dot as ungrouped", () => {
    expect(splitPermissionName("wildcard")).toEqual({
      module: UNGROUPED_MODULE,
      resource: UNGROUPED_RESOURCE,
      action: "wildcard",
    });
  });

  it("ignores empty segments instead of rendering blanks", () => {
    expect(splitPermissionName(".users..read")).toEqual({
      module: "users",
      resource: UNGROUPED_RESOURCE,
      action: "read",
    });
  });
});

describe("groupPermissionsByModule", () => {
  const catalog = [
    { id: "1", name: "permissions.manage" },
    { id: "2", name: "permissions.read" },
    { id: "3", name: "training.plans.read" },
    { id: "4", name: "training.plans.update" },
    { id: "5", name: "training.workouts.read" },
    { id: "6", name: "training.adapt" },
  ];

  it("groups by module and keeps the incoming module order", () => {
    const modules = groupPermissionsByModule(catalog);

    expect(modules.map((entry) => entry.module)).toEqual([
      "permissions",
      "training",
    ]);
  });

  it("splits a module into its resources", () => {
    const modules = groupPermissionsByModule(catalog);

    expect(modules[1].resources.map((entry) => entry.resource)).toEqual([
      "plans",
      "workouts",
      UNGROUPED_RESOURCE,
    ]);
    expect(modules[1].resources[0].permissions.map((item) => item.id)).toEqual([
      "3",
      "4",
    ]);
  });

  it("preserves the incoming order inside a resource", () => {
    const modules = groupPermissionsByModule([
      { id: "b", name: "users.delete" },
      { id: "a", name: "users.create" },
    ]);

    expect(modules).toHaveLength(1);
    expect(modules[0].resources[0].permissions.map((item) => item.name)).toEqual([
      "users.delete",
      "users.create",
    ]);
  });

  it("files permissions without a module into the ungrouped bucket", () => {
    const modules = groupPermissionsByModule([
      { id: "1", name: "users.read" },
      { id: "2", name: "wildcard" },
    ]);

    expect(modules.map((entry) => entry.module)).toEqual([
      "users",
      UNGROUPED_MODULE,
    ]);
  });

  it("returns nothing for an empty catalog", () => {
    expect(groupPermissionsByModule([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const input = [
      { id: "1", name: "users.read" },
      { id: "2", name: "users.create" },
    ];

    groupPermissionsByModule(input);

    expect(input.map((item) => item.name)).toEqual(["users.read", "users.create"]);
  });
});
