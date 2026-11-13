import { Body, Controller, Delete, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { AccountDeletionService } from './account-deletion.service';
import { DeleteAccountDto } from './dto/delete-account.dto';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller({ path: 'auth', version: '1' })
export class AccountDeletionController {
  constructor(private readonly accountDeletionService: AccountDeletionService) {}

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('account.delete')
  @ApiOperation({
    summary: 'Delete the own account',
    description:
      'Signs out of every session, revokes Strava access and permanently deletes all data within 24 hours. ' +
      'Cannot be undone. Errors: ACCOUNT_DELETION_FORBIDDEN for system accounts.',
  })
  @ApiNoContentResponse({ description: 'Account deactivated, data purge scheduled' })
  deleteMe(@CurrentUser() user: AuthUserContext, @Body() dto: DeleteAccountDto): Promise<void> {
    // `confirm: true` is enforced by validation; reaching here means the user confirmed.
    void dto;
    return this.accountDeletionService.requestDeletion(user.id);
  }
}
