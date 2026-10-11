import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsOptional, IsUUID } from 'class-validator';

/**
 * Caps how many users one presence lookup may cover.
 *
 * Presence is asked about the rows currently on screen, so a handful is plenty;
 * the cap also keeps the endpoint from being used to enumerate who is active.
 */
export const USER_PRESENCE_MAX_IDS = 200;

export class UserPresenceQueryDto {
  @ApiPropertyOptional({
    type: [String],
    isArray: true,
    description: 'User ids to report online status for',
    example: ['0f2b1c34-1a2b-4c3d-8e5f-6a7b8c9d0e1f'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(USER_PRESENCE_MAX_IDS)
  // 'all', not '4': the project issues UUIDv7 (`uuidv7`), so pinning this to
  // version 4 rejects every newer id and turns the whole lookup into a 400 —
  // which silently reads as "nobody is online" rather than as an error.
  @IsUUID('all', { each: true })
  @Transform(({ value }: { value: unknown }) => {
    // Accepts both `?ids=a&ids=b` and `?ids=a,b`, because the query string is
    // typed by hand often enough that guessing wrong should not be an error.
    const raw = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : value;

    return typeof raw === 'string' ? [raw] : raw;
  })
  ids?: string[];
}
