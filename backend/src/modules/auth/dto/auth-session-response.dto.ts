import { ApiProperty } from '@nestjs/swagger';

import type { AuthSessionRecord } from '../interfaces/auth-session.interface';

export class AuthSessionResponseDto {
  @ApiProperty({ example: '6f1d7c3a-9a55-4b4f-9e2d-9c10b8c8d8e8' })
  id!: string;

  @ApiProperty({ type: String, nullable: true, example: 'iPhone 15 Pro', description: 'Reported by the app' })
  deviceName!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'ios' })
  platform!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '1.4.0' })
  appVersion!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Moscow', description: 'By IP at sign-in; may be empty' })
  city!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'RU' })
  country!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Fallback when the app did not report the device' })
  userAgent!: string | null;

  @ApiProperty({ example: '2026-10-01T08:00:00.000Z' })
  createdAt!: string;

  @ApiProperty({ example: '2026-10-15T08:00:00.000Z', description: 'Last token refresh' })
  lastActiveAt!: string;

  @ApiProperty({ description: 'The session making this request' })
  current!: boolean;
}

export function toAuthSessionResponse(session: AuthSessionRecord, currentSessionId: string): AuthSessionResponseDto {
  return {
    id: session.sessionId,
    deviceName: session.deviceName ?? null,
    platform: session.platform ?? null,
    appVersion: session.appVersion ?? null,
    city: session.city ?? null,
    country: session.country ?? null,
    userAgent: session.userAgent,
    createdAt: session.createdAt,
    lastActiveAt: session.updatedAt,
    current: session.sessionId === currentSessionId,
  };
}

export class AuthSessionListResponseDto {
  @ApiProperty({ type: [AuthSessionResponseDto] })
  items!: AuthSessionResponseDto[];
}
