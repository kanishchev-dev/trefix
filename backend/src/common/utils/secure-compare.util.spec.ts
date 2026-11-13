import { secureCompare } from './secure-compare.util';

describe('secureCompare', () => {
  it('matches equal secrets only', () => {
    expect(secureCompare('token', 'token')).toBe(true);
    expect(secureCompare('token', 'token2')).toBe(false);
    expect(secureCompare('', 'token')).toBe(false);
  });
});
