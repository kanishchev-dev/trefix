import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';

import { REALTIME_ROOM_PERMISSION_MAP } from './constants/realtime-permissions.constants';

/**
 * Keeps the backend emissions and the frontend cache invalidation map in step.
 *
 * Nothing at runtime enforces it: an event the backend publishes simply never
 * reaches a query cache, and the UI keeps showing stale data until somebody
 * reloads the page. That is invisible in review, so it is asserted here.
 */

const SRC_ROOT = join(__dirname, '..', '..');

/** Rooms the admin app subscribes to; other rooms belong to other clients. */
const ADMIN_ROOMS = new Set(Object.keys(REALTIME_ROOM_PERMISSION_MAP));

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

function findFiles(root: string, suffix: string): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(root)) {
    const path = join(root, entry);

    if (entry === 'node_modules' || entry === 'dist') {
      continue;
    }

    if (statSync(path).isDirectory()) {
      found.push(...findFiles(path, suffix));
    } else if (entry.endsWith(suffix)) {
      found.push(path);
    }
  }

  return found;
}

/** Events published to a room, keyed by the room they were published to. */
function collectEmittedEvents(): Map<string, Set<string>> {
  const eventsByRoom = new Map<string, Set<string>>();

  const record = (room: string, event: string) => {
    const events = eventsByRoom.get(room) ?? new Set<string>();
    events.add(event);
    eventsByRoom.set(room, events);
  };

  const literalCall = /emitToRoom\(\s*'([^']+)'\s*,\s*'([^']+)'/g;
  // Settings publish through constants rather than literals.
  const settingsCall = 'emitToRoom(SETTINGS_ROOM, SETTINGS_REALTIME_EVENT';
  const settingsConstants = readFileSync(
    join(SRC_ROOT, 'modules', 'settings', 'settings.constants.ts'),
    'utf8',
  );
  const settingsRoom = /SETTINGS_ROOM\s*=\s*'([^']+)'/.exec(settingsConstants)?.[1];
  const settingsEvent = /SETTINGS_REALTIME_EVENT\s*=\s*'([^']+)'/.exec(settingsConstants)?.[1];

  for (const path of findFiles(join(SRC_ROOT, 'modules'), '.listener.ts')) {
    const source = readFileSync(path, 'utf8');

    for (const match of source.matchAll(literalCall)) {
      record(match[1], match[2]);
    }

    if (source.includes(settingsCall) && settingsRoom && settingsEvent) {
      record(settingsRoom, settingsEvent);
    }
  }

  recordPresenceEmission(record);

  return eventsByRoom;
}

/**
 * Presence is published straight from its service rather than through an event
 * listener, so the literal scan above cannot see it.
 *
 * Scanned explicitly instead of skipped: an event the frontend reacts to but
 * the backend never publishes is the exact drift this file exists to catch, and
 * skipping the check would quietly remove one.
 */
function recordPresenceEmission(record: (room: string, event: string) => void): void {
  const servicePath = join(
    SRC_ROOT,
    'modules',
    'realtime',
    'services',
    'realtime-presence.service.ts',
  );

  if (!existsSync(servicePath)) {
    return;
  }

  const source = readFileSync(servicePath, 'utf8');

  if (!source.includes('emitToRoom(PRESENCE_ROOM, REALTIME_PRESENCE_EVENT')) {
    return;
  }

  const room = /const PRESENCE_ROOM\s*=\s*'([^']+)'/.exec(source)?.[1];
  const event = /REALTIME_PRESENCE_EVENT\s*=\s*'([^']+)'/.exec(
    readFileSync(join(SRC_ROOT, 'modules', 'realtime', 'constants', 'realtime.constants.ts'), 'utf8'),
  )?.[1];

  if (room && event) {
    record(room, event);
  }
}

/** Event names the frontend reacts to, read from its invalidation map. */
function collectHandledEvents(): Set<string> {
  const path = join(
    findRepoRoot(),
    'frontend',
    'apps',
    'web',
    'src',
    'shared',
    'api',
    'realtime-events.ts',
  );
  const source = readFileSync(path, 'utf8');
  const block = /REALTIME_EVENT_CACHE_KEYS[\s\S]*?=[\s\S]*?\{([\s\S]*?)\n\};/.exec(source)?.[1];

  if (!block) {
    throw new Error('Could not read REALTIME_EVENT_CACHE_KEYS from the frontend');
  }

  return new Set([...block.matchAll(/^\s{2}"([^"]+)":/gm)].map((match) => match[1]));
}

/** Room names the frontend asks the gateway for. */
function collectRequestedRooms(): Set<string> {
  const path = join(
    findRepoRoot(),
    'frontend',
    'apps',
    'web',
    'src',
    'shared',
    'api',
    'realtime-events.ts',
  );
  const source = readFileSync(path, 'utf8');
  const block = /REALTIME_ROOMS[\s\S]*?=[\s\S]*?\{([\s\S]*?)\n\};/.exec(source)?.[1];

  if (!block) {
    throw new Error('Could not read REALTIME_ROOMS from the frontend');
  }

  return new Set([...block.matchAll(/^\s{2}(\w+):/gm)].map((match) => match[1]));
}

/** Permissions the frontend requires per room. */
function collectRequiredPermissions(): Map<string, string[]> {
  const path = join(
    findRepoRoot(),
    'frontend',
    'apps',
    'web',
    'src',
    'shared',
    'api',
    'realtime-events.ts',
  );
  const source = readFileSync(path, 'utf8');
  const block = /REALTIME_ROOMS[\s\S]*?=[\s\S]*?\{([\s\S]*?)\n\};/.exec(source)?.[1];

  if (!block) {
    throw new Error('Could not read REALTIME_ROOMS from the frontend');
  }

  const required = new Map<string, string[]>();

  for (const [, room, permissions] of block.matchAll(/^\s{2}(\w+):\s*\[([^\]]*)\]/gm)) {
    required.set(room, [...permissions.matchAll(/"([^"]+)"/g)].map((match) => match[1]));
  }

  return required;
}

describe('realtime event wiring', () => {
  const emitted = collectEmittedEvents();
  const handled = collectHandledEvents();

  it('finds the admin rooms to check against', () => {
    expect([...ADMIN_ROOMS].sort()).toEqual(['permissions', 'settings', 'users']);
    expect(emitted.get('users')).toBeDefined();
    expect(emitted.get('settings')).toBeDefined();
  });

  it('reacts to every event published to a room the admin app subscribes to', () => {
    const unhandled = [...emitted]
      .filter(([room]) => ADMIN_ROOMS.has(room))
      .flatMap(([, events]) => [...events])
      .filter((event) => !handled.has(event))
      .sort();

    expect(unhandled).toEqual([]);
  });

  it('does not react to events no admin room publishes', () => {
    const adminEvents = new Set(
      [...emitted]
        .filter(([room]) => ADMIN_ROOMS.has(room))
        .flatMap(([, events]) => [...events]),
    );

    // Stale entries would keep the map honest instead of drifting into placeholders.
    expect([...handled].filter((event) => !adminEvents.has(event)).sort()).toEqual([]);
  });

  it('requests only rooms the gateway knows about', () => {
    const unknown = [...collectRequestedRooms()].filter((room) => !ADMIN_ROOMS.has(room)).sort();

    expect(unknown).toEqual([]);
  });

  /**
   * The gateway throws on the whole subscribe call when one room is forbidden,
   * so the client must not ask for a room using a permission the gateway does
   * not accept for it — that would cost every other room as well.
   */
  it('asks for each room with permissions the gateway actually grants there', () => {
    for (const [room, required] of collectRequiredPermissions()) {
      const granted = REALTIME_ROOM_PERMISSION_MAP[room] ?? [];
      const accepted = required.filter((permission) => !granted.includes(permission));

      expect({ room, accepted }).toEqual({ room, accepted: [] });
    }
  });
});