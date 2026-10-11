import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { dirname, join } from 'path';

import {
  DEFAULT_USER_PERMISSION_KEYS,
  SYSTEM_PERMISSION_CATALOG,
  SYSTEM_PERMISSION_GROUPS,
  SYSTEM_PERMISSION_KEYS,
} from './system-access.constants';

const SRC_ROOT = join(__dirname, '..', '..');

/** Walks up from this file until the repository root (the folder with `frontend`). */
function findRepoRoot(): string {
  let current = __dirname;

  while (!existsSync(join(current, 'frontend'))) {
    const parent = dirname(current);

    if (parent === current) {
      throw new Error('Could not locate the repository root');
    }

    current = parent;
  }

  return current;
}

type LocaleDictionary = Record<string, unknown>;

function readLocale(name: 'en' | 'ru'): LocaleDictionary {
  const path = join(findRepoRoot(), 'frontend', 'apps', 'web', 'src', 'shared', 'i18n', 'locales', `${name}.json`);

  return JSON.parse(readFileSync(path, 'utf8')) as LocaleDictionary;
}

/** Resolves a dotted path the same way the frontend translation lookup does. */
function resolveLocaleKey(dictionary: LocaleDictionary, key: string): unknown {
  return key.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object' && segment in (current as Record<string, unknown>)) {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, dictionary);
}

/**
 * Flattens a nested locale section back into dotted keys. The frontend lookup
 * splits the requested key on dots, so a description must be nested by the
 * segments of the permission name — a literal `"training.plans.read"` key would
 * never be found. This helper mirrors that shape.
 */
function flattenLocaleKeys(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([segment, nested]) =>
    flattenLocaleKeys(nested, prefix ? `${prefix}.${segment}` : segment),
  );
}

/** Collects every `*.controller.ts` under `src/modules`. */
function listControllers(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = join(directory, entry);

    if (statSync(fullPath).isDirectory()) {
      return listControllers(fullPath);
    }

    return fullPath.endsWith('.controller.ts') ? [fullPath] : [];
  });
}

/** Extracts every permission referenced by `@RequirePermissions(...)`. */
function collectGuardedPermissions(): string[] {
  const guarded = new Set<string>();

  for (const controllerPath of listControllers(SRC_ROOT)) {
    const source = readFileSync(controllerPath, 'utf8');
    const matches = source.matchAll(/@RequirePermissions\(\s*'([^']+)'/g);

    for (const match of matches) {
      guarded.add(match[1]);
    }
  }

  return Array.from(guarded);
}

describe('SYSTEM_PERMISSION_CATALOG', () => {
  it('has unique keys and a `module[.resource].action` shape', () => {
    const keys = SYSTEM_PERMISSION_CATALOG.map((permission) => permission.key);

    expect(new Set(keys).size).toBe(keys.length);

    for (const permission of SYSTEM_PERMISSION_CATALOG) {
      expect(permission.key).toMatch(/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*){1,2}$/);
      expect(permission.description.length).toBeGreaterThan(0);
    }
  });

  it('covers every permission referenced by a guarded endpoint', () => {
    const missing = collectGuardedPermissions().filter((key) => !SYSTEM_PERMISSION_KEYS.includes(key));

    expect(missing).toEqual([]);
  });

  it('has no permission that no endpoint uses', () => {
    const guarded = collectGuardedPermissions();
    const unused = SYSTEM_PERMISSION_KEYS.filter((key) => !guarded.includes(key));

    expect(unused).toEqual([]);
  });

  it('splits every key into the module, resource and action it declares', () => {
    for (const permission of SYSTEM_PERMISSION_CATALOG) {
      const segments = permission.key.split('.');

      expect(permission.module).toBe(segments[0]);
      expect(permission.action).toBe(segments[segments.length - 1]);
      expect(permission.resource).toBe(segments.slice(1, -1).join('.'));
    }
  });

  it('defaults every group to permissions that exist', () => {
    for (const group of SYSTEM_PERMISSION_GROUPS) {
      const missing = group.permissionKeys.filter((key) => !SYSTEM_PERMISSION_KEYS.includes(key));

      expect(missing).toEqual([]);
    }
  });

  it('keeps admin-only capabilities out of the default user group', () => {
    expect(DEFAULT_USER_PERMISSION_KEYS).not.toContain('permissions.manage');
    expect(DEFAULT_USER_PERMISSION_KEYS).not.toContain('users.manage');
    expect(DEFAULT_USER_PERMISSION_KEYS).not.toContain('settings.update');
    expect(DEFAULT_USER_PERMISSION_KEYS).not.toContain('training.calendar.read');
    expect(DEFAULT_USER_PERMISSION_KEYS).not.toContain('training.calendar.manage');
    expect(DEFAULT_USER_PERMISSION_KEYS).not.toContain('training.userplans.read');
    expect(DEFAULT_USER_PERMISSION_KEYS).not.toContain('training.userplans.manage');
    expect(DEFAULT_USER_PERMISSION_KEYS).toContain('training.plans.read');
  });

  it('gives the administrators group every permission in the catalog', () => {
    const administrators = SYSTEM_PERMISSION_GROUPS[0];

    expect(administrators.permissionKeys).toEqual(SYSTEM_PERMISSION_KEYS);
  });

  /**
   * A permission without a translation is a bug the user only sees in one
   * language, so the catalog and the locale files are checked against each
   * other here rather than trusted to review.
   */
  describe('translations', () => {
    const locales = { en: readLocale('en'), ru: readLocale('ru') };

    it('translates the description of every permission in every locale', () => {
      const missing = Object.entries(locales).flatMap(([locale, dictionary]) =>
        SYSTEM_PERMISSION_CATALOG.filter(
          (permission) => !resolveLocaleKey(dictionary, `permissions.descriptions.${permission.key}`),
        ).map((permission) => `${locale}: ${permission.key}`),
      );

      expect(missing).toEqual([]);
    });

    it('translates every module, resource and action', () => {
      const missing = Object.entries(locales).flatMap(([locale, dictionary]) => {
        const keys = new Set<string>(['permissions.domains.other']);

        for (const permission of SYSTEM_PERMISSION_CATALOG) {
          keys.add(`permissions.domains.${permission.module}`);

          if (permission.resource) {
            keys.add(`permissions.resources.${permission.module}.${permission.resource}`);
          }

          keys.add(`permissions.actions.${permission.action}`);
        }

        return Array.from(keys)
          .filter((key) => !resolveLocaleKey(dictionary, key))
          .map((key) => `${locale}: ${key}`);
      });

      expect(missing).toEqual([]);
    });

    it('has no description translation the catalog does not know about', () => {
      const known = new Set(SYSTEM_PERMISSION_KEYS);

      for (const dictionary of Object.values(locales)) {
        const descriptions = (dictionary as { permissions: { descriptions: LocaleDictionary } }).permissions
          .descriptions;

        expect(flattenLocaleKeys(descriptions).filter((key) => !known.has(key))).toEqual([]);
      }
    });
  });
});
