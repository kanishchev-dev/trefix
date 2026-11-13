import { describe, expect, it } from "vitest";

import {
  adminCreateUserSchema,
  adminUpdateUserSchema,
  updateSettingsSchema,
  userListQuerySchema,
} from "@trefix/api-client";

describe("admin user contract schemas", () => {
  describe("adminCreateUserSchema", () => {
    it("accepts a valid invite-mode payload", () => {
      const result = adminCreateUserSchema.safeParse({
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
      });

      expect(result.success).toBe(true);
    });

    it("accepts a password-mode payload", () => {
      const result = adminCreateUserSchema.safeParse({
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
        password: "Str0ngPass!",
        emailVerified: true,
      });

      expect(result.success).toBe(true);
    });

    it("rejects a short password", () => {
      const result = adminCreateUserSchema.safeParse({
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
        password: "short",
      });

      expect(result.success).toBe(false);
    });

    it("rejects an invalid email", () => {
      const result = adminCreateUserSchema.safeParse({
        email: "not-an-email",
        firstName: "John",
        lastName: "Doe",
      });

      expect(result.success).toBe(false);
    });
  });

  describe("adminUpdateUserSchema", () => {
    it("accepts a partial update", () => {
      expect(
        adminUpdateUserSchema.safeParse({ firstName: "Jane" }).success,
      ).toBe(true);
    });

    it("rejects an empty first name", () => {
      expect(adminUpdateUserSchema.safeParse({ firstName: "" }).success).toBe(
        false,
      );
    });

    it("rejects a non-boolean emailVerified", () => {
      expect(
        adminUpdateUserSchema.safeParse({ emailVerified: "yes" }).success,
      ).toBe(false);
    });
  });

  describe("updateSettingsSchema", () => {
    it("accepts theme and locale updates", () => {
      expect(
        updateSettingsSchema.safeParse({ theme: "dark", locale: "ru" }).success,
      ).toBe(true);
    });

    it("rejects unsupported theme values", () => {
      expect(updateSettingsSchema.safeParse({ theme: "neon" }).success).toBe(
        false,
      );
    });

    it("rejects unsupported locale values", () => {
      expect(updateSettingsSchema.safeParse({ locale: "fr" }).success).toBe(
        false,
      );
    });

    it("rejects non-uuid group ids", () => {
      expect(
        updateSettingsSchema.safeParse({ defaultGroups: ["not-uuid"] }).success,
      ).toBe(false);
    });
  });

  describe("userListQuerySchema", () => {
    it("applies defaults for pagination and sorting", () => {
      const result = userListQuerySchema.parse({});

      expect(result).toEqual({
        page: 1,
        limit: 10,
        sortBy: "createdAt",
        sortOrder: "DESC",
      });
    });

    it("rejects limit above the maximum", () => {
      expect(userListQuerySchema.safeParse({ limit: 500 }).success).toBe(false);
    });
  });
});
