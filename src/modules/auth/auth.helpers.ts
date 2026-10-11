import { createHash, randomInt } from 'crypto';

import { comparePassword, hashPassword } from '@/common/utils/password-hash.util';
import { User } from '@/modules/users/entities/user.entity';

import { AUTH_DEFAULT_DISPLAY_NAME, AUTH_PASSWORD_HASH_ROUNDS } from './auth.constants';
import { AuthUserResponseDto } from './dto/auth-user-response.dto';

/** Pure helpers shared by the auth services. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function resolveRegistrationName(
  email: string,
  firstName?: string,
  lastName?: string,
): { firstName: string; lastName: string } {
  if (firstName || lastName) {
    return {
      firstName: firstName?.trim() || AUTH_DEFAULT_DISPLAY_NAME,
      lastName: lastName?.trim() || '',
    };
  }

  const localPart = email.split('@')[0] || AUTH_DEFAULT_DISPLAY_NAME;
  const normalizedLocalPart = localPart.replace(/[._-]+/g, ' ').trim();

  return {
    firstName: normalizedLocalPart || AUTH_DEFAULT_DISPLAY_NAME,
    lastName: '',
  };
}

export function toAuthUserResponse(user: User, permissions?: string[]): AuthUserResponseDto {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl ?? undefined,
    referralCode: user.referralCode ?? undefined,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    permissions,
    features: {
      showReferral: !!user.referralCode,
    },
  };
}

export async function hashUserPassword(password: string): Promise<string> {
  return hashPassword(password, AUTH_PASSWORD_HASH_ROUNDS);
}

export async function verifyUserPassword(password: string, passwordHash: string): Promise<boolean> {
  return comparePassword(password, passwordHash);
}

export function hashSecret(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function generateNumericCode(length: number): string {
  const upperBound = 10 ** length;
  return String(randomInt(0, upperBound)).padStart(length, '0');
}
