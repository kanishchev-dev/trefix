import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

import { EntityAlreadyExistsException } from './entity-already-exists.exception';
import { EntityNotFoundException } from './entity-not-found.exception';
import { toErrorCodePart } from './error-code.util';

const SRC = join(__dirname, '..', '..');
const I18N = join(SRC, '..', 'i18n');
const CODE = /^[A-Z][A-Z0-9_]*$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      return sourceFiles(path);
    }
    return path.endsWith('.ts') && !path.endsWith('.spec.ts') ? [path] : [];
  });
}

/** Codes thrown over HTTP: literal first arguments of exceptions and the derived entity codes. */
function thrownCodes(): Set<string> {
  const codes = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    const text = readFileSync(file, 'utf8');
    // Domain exceptions take the code first; subclasses pass theirs to `super`.
    // Other exceptions take arguments (entity or provider names) and own their code.
    for (const match of text.matchAll(/(?:new (?:Domain\w*|ForbiddenAction)Exception|super)\(\s*'([A-Za-z][\w.]+)'/g)) {
      codes.add(match[1]);
    }
    for (const match of text.matchAll(/new EntityNotFoundException\(\s*'(\w+)'/g)) {
      codes.add(`${toErrorCodePart(match[1])}_NOT_FOUND`);
    }
    for (const match of text.matchAll(/new EntityAlreadyExistsException\(\s*'(\w+)',\s*'(\w+)'/g)) {
      codes.add(`${toErrorCodePart(match[1])}_${toErrorCodePart(match[2])}_ALREADY_EXISTS`);
    }
  }
  return codes;
}

describe('error codes', () => {
  it('derives flat UPPER_SNAKE codes for entity exceptions', () => {
    expect(new EntityNotFoundException('CoachSession', 'x').code).toBe('COACH_SESSION_NOT_FOUND');
    expect(new EntityNotFoundException('TrainingPlan', 'x').code).toBe('TRAINING_PLAN_NOT_FOUND');
    expect(new EntityAlreadyExistsException('Athlete', 'userId', 'x').code).toBe('ATHLETE_USER_ID_ALREADY_EXISTS');
  });

  const codes = [...thrownCodes()];

  it('uses only flat UPPER_SNAKE codes', () => {
    expect(codes.filter((code) => !CODE.test(code))).toEqual([]);
  });

  it.each(['en', 'ru'])('has a %s message for every code', (lang) => {
    const messages = JSON.parse(readFileSync(join(I18N, lang, 'common.json'), 'utf8')).ERRORS as Record<string, string>;
    expect(codes.filter((code) => !messages[code]).sort()).toEqual([]);
  });
});
