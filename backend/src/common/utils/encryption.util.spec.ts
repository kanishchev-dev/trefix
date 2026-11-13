import { decryptToken, encryptToken } from './encryption.util';

describe('encryption.util', () => {
  const masterKey = 'test_master_key_for_encryption_unit_tests!';

  it('encrypts and decrypts string correctly', () => {
    const originalText = 'strava_access_token_123456789';
    const encrypted = encryptToken(originalText, masterKey);

    expect(encrypted).not.toEqual(originalText);
    expect(encrypted).toContain(':');

    const decrypted = decryptToken(encrypted, masterKey);
    expect(decrypted).toEqual(originalText);
  });

  it('returns empty string for empty input', () => {
    expect(encryptToken('', masterKey)).toEqual('');
    expect(decryptToken('', masterKey)).toEqual('');
  });

  it('throws error when decrypting invalid ciphertext', () => {
    expect(() => decryptToken('invalid_ciphertext', masterKey)).toThrow();
  });
});
