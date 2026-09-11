import { pbkdf2, randomBytes, timingSafeEqual } from 'crypto';

const PASSWORD_HASH_PREFIX = 'pbkdf2';
const PASSWORD_HASH_DIGEST = 'sha512';
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_HASH_SALT_LENGTH = 16;

function pbkdf2Async(password: string, salt: string, iterations: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    pbkdf2(password, salt, iterations, PASSWORD_HASH_KEY_LENGTH, PASSWORD_HASH_DIGEST, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(derivedKey);
    });
  });
}

function resolveIterations(saltOrRounds: number): number {
  return 2 ** Math.max(1, Math.min(saltOrRounds, 20));
}

export async function hashPassword(password: string, saltOrRounds: number): Promise<string> {
  const iterations = resolveIterations(saltOrRounds);
  const salt = randomBytes(PASSWORD_HASH_SALT_LENGTH).toString('hex');
  const derivedKey = await pbkdf2Async(password, salt, iterations);

  return `${PASSWORD_HASH_PREFIX}$${iterations}$${salt}$${derivedKey.toString('hex')}`;
}

export async function comparePassword(password: string, passwordHash: string): Promise<boolean> {
  const parts = passwordHash.split('$');
  if (parts.length !== 4 || parts[0] !== PASSWORD_HASH_PREFIX) {
    return false;
  }

  const iterations = Number.parseInt(parts[1] || '', 10);
  const salt = parts[2];
  const storedHash = parts[3];

  if (!Number.isInteger(iterations) || iterations <= 0 || !salt || !storedHash) {
    return false;
  }

  const derivedKey = await pbkdf2Async(password, salt, iterations);
  const storedBuffer = Buffer.from(storedHash, 'hex');

  if (storedBuffer.length !== derivedKey.length) {
    return false;
  }

  return timingSafeEqual(storedBuffer, derivedKey);
}
