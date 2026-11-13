import { OmitType } from '@nestjs/swagger';

import { AdminUserResponseDto } from './admin-user-response.dto';

/** A user as list and create endpoints return it: the account without access details. */
export class UserResponseDto extends OmitType(AdminUserResponseDto, [
  'groups',
  'individualPermissions',
  'effectivePermissions',
] as const) {}
