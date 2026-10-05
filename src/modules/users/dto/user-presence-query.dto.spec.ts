import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

import { UserPresenceQueryDto } from './user-presence-query.dto';

/**
 * Ids the project actually issues.
 *
 * `uuidv7` produces version 7, so a validator pinned to version 4 — the kind
 * that reads as correct because test fixtures are usually hand-written v4
 * strings — rejects every real id. The lookup then answers 400 for the whole
 * batch and the UI shows nobody online, with no error anywhere to explain it.
 */
const UUID_V4 = '0519d39b-9529-4ce5-9471-48b98463dbf1';
const UUID_V7 = '01a0c320-1321-77fb-a76d-76437d2ff833';

function validate(query: Record<string, unknown>): string[] {
  const errors = validateSync(plainToInstance(UserPresenceQueryDto, query));

  return errors.flatMap((error) => Object.values(error.constraints ?? {}));
}

describe('UserPresenceQueryDto', () => {
  it('accepts the ids the project issues, whichever UUID version they use', () => {
    expect(validate({ ids: [UUID_V4, UUID_V7] })).toEqual([]);
  });

  it('accepts a single id', () => {
    expect(validate({ ids: [UUID_V4] })).toEqual([]);
  });

  it('accepts the comma separated form as well', () => {
    expect(validate({ ids: `${UUID_V4},${UUID_V7}` })).toEqual([]);
  });

  it('treats a missing list as "ask about nobody"', () => {
    expect(validate({})).toEqual([]);
  });

  it('still rejects something that is not an id', () => {
    expect(validate({ ids: ['not-a-uuid'] })).not.toEqual([]);
  });

  it('caps how many ids one lookup may cover', () => {
    const many = Array.from({ length: 201 }, () => UUID_V4);

    expect(validate({ ids: many })).not.toEqual([]);
    expect(validate({ ids: many.slice(0, 200) })).toEqual([]);
  });
});