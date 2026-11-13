import { describe, expect, it } from "vitest";

import en from "@/shared/i18n/locales/en.json";
import ru from "@/shared/i18n/locales/ru.json";

/**
 * Flattens a locale section into dotted keys, the same shape the permission
 * label helper looks up (`permissions.actions.read`,
 * `permissions.descriptions.training.plans.update`).
 */
function flatten(value: unknown, prefix = ""): string[] {
  if (typeof value !== "object" || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, nested]) =>
    flatten(nested, prefix ? `${prefix}.${key}` : key),
  );
}

function permissionKeys(locale: typeof en): Record<string, string[]> {
  return {
    domains: flatten(locale.permissions.domains).sort(),
    resources: flatten(locale.permissions.resources).sort(),
    actions: flatten(locale.permissions.actions).sort(),
    descriptions: flatten(locale.permissions.descriptions).sort(),
  };
}

describe("permission locales", () => {
  it("translate exactly the same keys in both languages", () => {
    expect(permissionKeys(ru)).toEqual(permissionKeys(en));
  });

  it("has no empty translation", () => {
    for (const locale of [en, ru]) {
      for (const section of [
        "domains",
        "resources",
        "actions",
        "descriptions",
      ]) {
        for (const [key, value] of Object.entries(
          locale.permissions[section as keyof typeof locale.permissions],
        )) {
          expect(`${section}.${key}: ${JSON.stringify(value)}`).not.toContain(
            ': ""',
          );
        }
      }
    }
  });

  it("names every module that the backend catalog can produce", () => {
    for (const moduleName of [
      "permissions",
      "users",
      "account",
      "settings",
      "storage",
      "integrations",
      "coach",
      "training",
    ]) {
      expect(Object.keys(en.permissions.domains)).toContain(moduleName);
      expect(Object.keys(ru.permissions.domains)).toContain(moduleName);
    }
  });
});
