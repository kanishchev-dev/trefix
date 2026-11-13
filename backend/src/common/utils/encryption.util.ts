import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

/** Stored ciphertext is corrupted or was not produced by `encryptToken`. */
export class InvalidCiphertextError extends Error {
  constructor() {
    super('Invalid ciphertext format');
    this.name = 'InvalidCiphertextError';
  }
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const SALT = 'trefix-integrations-token-salt';

/**
 * scrypt is deliberately slow and synchronous here, so it runs once per secret
 * instead of on every token read — the master key does not change at runtime.
 */
const derivedKeys = new Map<string, Buffer>();

function deriveKey(secret: string): Buffer {
  let key = derivedKeys.get(secret);
  if (!key) {
    key = scryptSync(secret, SALT, 32);
    derivedKeys.set(secret, key);
  }
  return key;
}

/** Encrypts plaintext string using AES-256-GCM. */
export function encryptToken(text: string, masterKey: string): string {
  if (!text) return '';
  const key = deriveKey(masterKey);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/** Decrypts encrypted string formatted as iv:authTag:encryptedData. */
export function decryptToken(cipherText: string, masterKey: string): string {
  if (!cipherText) return '';
  const parts = cipherText.split(':');
  if (parts.length !== 3) {
    throw new InvalidCiphertextError();
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = deriveKey(masterKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
