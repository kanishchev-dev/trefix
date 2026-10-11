import { describe, expect, it } from "vitest";

import { permissionGroupSchema } from "@workspace/api-client";

/**
 * `GET /admin/permissions/groups/:id` includes the group's members with a
 * restricted attribute set (see `PermissionsService.findGroup`), which is a
 * narrower projection than the full admin user resource returned by
 * `GET /admin/users`. The schemas have to reflect that, otherwise every
 * non-empty group fails to parse and the detail page falls back to an error
 * state.
 */
describe("permissionGroupSchema", () => {
  const groupDetailPayload = {
    id: "6c9b1f7e-0f5e-4f2e-9a2b-8f4a5d6c7e8f",
    name: "Administrators",
    description: "Full access",
    systemKey: "administrators",
    isSystem: true,
    permissions: [
      {
        id: "8d1c2a3b-4c5d-6e7f-8a9b-0c1d2e3f4a5b",
        name: "users.read",
        description: "Read users",
        createdAt: "2026-10-01T10:00:00.000Z",
        updatedAt: "2026-10-01T10:00:00.000Z",
      },
    ],
    users: [
      {
        id: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
        firstName: "Ada",
        lastName: "Lovelace",
        email: "ada@example.com",
        isSystem: true,
      },
    ],
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
  };

  it("parses the group detail payload with its member projection", () => {
    const result = permissionGroupSchema.safeParse(groupDetailPayload);

    expect(result.success).toBe(true);
  });

  it("keeps the projected member fields available", () => {
    const group = permissionGroupSchema.parse(groupDetailPayload);
    const member = group.users?.[0];

    expect(member?.id).toBe("1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d");
    expect(member?.firstName).toBe("Ada");
    expect(member?.lastName).toBe("Lovelace");
    expect(member?.email).toBe("ada@example.com");
  });

  it("tolerates members without a last name", () => {
    const result = permissionGroupSchema.safeParse({
      ...groupDetailPayload,
      users: [{ id: "member-2", firstName: "Alan", email: "alan@example.com" }],
    });

    expect(result.success).toBe(true);
  });

  it("parses a group list entry that carries no relations", () => {
    const result = permissionGroupSchema.safeParse({
      id: "6c9b1f7e-0f5e-4f2e-9a2b-8f4a5d6c7e8f",
      name: "Support",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data.permissions).toBeUndefined();
  });
});
