import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { LogDataAccess } from '@/common/decorators/log-data-access.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import type { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { AccountDeletionService } from '../account-deletion/account-deletion.service';
import { ConsentsListResponseDto } from '../consents/dto/consent.dto';
import { UserConsentsService } from '../consents/user-consents.service';
import { DataExportResponseDto } from '../data-export/data-export.dto';
import { DataExportService } from '../data-export/data-export.service';
import { UpdateUserPreferencesDto, UserPreferencesResponseDto } from '../preferences/dto/user-preferences.dto';
import { UserPreferencesService } from '../preferences/user-preferences.service';
import { AccountSecurityResponseDto, BlockUserDto } from './admin-account.dto';
import { AdminAccountService } from './admin-account.service';

/**
 * Account of any user for the admin panel: status and blocking, deletion and
 * restore, app preferences, consents and data exports.
 */
@ApiTags('Admin Account')
@ApiBearerAuth()
@AdminEndpoint()
@ApiParam({ name: 'userId', format: 'uuid' })
@Controller({ path: 'users/:userId', version: '1' })
export class AdminAccountController {
  constructor(
    private readonly adminAccountService: AdminAccountService,
    private readonly accountDeletionService: AccountDeletionService,
    private readonly preferencesService: UserPreferencesService,
    private readonly consentsService: UserConsentsService,
    private readonly dataExportService: DataExportService,
  ) {}

  @Get('security')
  @RequirePermissions('users.security.read')
  @ApiOperation({ summary: 'Status, block, sign-in state and pending deletion of the account' })
  @ApiOkResponse({ type: AccountSecurityResponseDto })
  getSecurity(@Param('userId', ParseUUIDPipe) userId: string): Promise<AccountSecurityResponseDto> {
    return this.adminAccountService.getSecurity(userId);
  }

  @Post('block')
  @RequirePermissions('users.security.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Block the account: no sign-in, sessions ended unless asked to keep them' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'USER_BLOCK_FORBIDDEN, USER_ALREADY_BLOCKED' })
  @ApiBadRequestResponse({ description: 'USER_BLOCK_UNTIL_INVALID' })
  block(
    @CurrentUser() actor: AuthUserContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: BlockUserDto,
  ): Promise<void> {
    return this.adminAccountService.block(actor.id, userId, dto);
  }

  @Post('unblock')
  @RequirePermissions('users.security.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Lift the block' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'USER_NOT_BLOCKED' })
  unblock(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.adminAccountService.unblock(userId);
  }

  @Post('deletion')
  @RequirePermissions('users.security.manage', 'users.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete the account the way the user would: deactivate now, erase all data later' })
  @ApiNoContentResponse()
  requestDeletion(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.accountDeletionService.requestDeletion(userId);
  }

  @Post('restore')
  @RequirePermissions('users.security.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Restore a deleted account before its data is erased' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'ACCOUNT_DELETION_NOT_REQUESTED' })
  restore(@Param('userId', ParseUUIDPipe) userId: string): Promise<void> {
    return this.accountDeletionService.restore(userId);
  }

  @Get('preferences')
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'App preferences of the user, including the AI coach switch' })
  @ApiOkResponse({ type: UserPreferencesResponseDto })
  getPreferences(@Param('userId', ParseUUIDPipe) userId: string): Promise<UserPreferencesResponseDto> {
    return this.preferencesService.get(userId);
  }

  @Patch('preferences')
  @RequirePermissions('users.update')
  @ApiOperation({ summary: 'Change app preferences of the user' })
  @ApiOkResponse({ type: UserPreferencesResponseDto })
  updatePreferences(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateUserPreferencesDto,
  ): Promise<UserPreferencesResponseDto> {
    return this.preferencesService.update(userId, dto);
  }

  @Get('consents')
  @RequirePermissions('users.security.read')
  @ApiOperation({ summary: 'Current consents of the user; only the user can give or revoke them' })
  @ApiOkResponse({ type: ConsentsListResponseDto })
  getConsents(@Param('userId', ParseUUIDPipe) userId: string): Promise<ConsentsListResponseDto> {
    return this.consentsService.list(userId);
  }

  @Get('data-exports')
  @RequirePermissions('users.security.read')
  @ApiOperation({ summary: 'Data exports of the user, newest first' })
  @ApiOkResponse({ type: DataExportResponseDto, isArray: true })
  listDataExports(@Param('userId', ParseUUIDPipe) userId: string): Promise<DataExportResponseDto[]> {
    return this.dataExportService.listForUser(userId);
  }

  @Post('data-exports')
  @RequirePermissions('users.security.manage')
  @ApiOperation({
    summary: 'Build a data export; the user gets the link by email',
    description: 'Errors: DATA_EXPORT_RATE_LIMITED',
  })
  @ApiOkResponse({ type: DataExportResponseDto })
  requestDataExport(@Param('userId', ParseUUIDPipe) userId: string): Promise<DataExportResponseDto> {
    return this.dataExportService.request(userId);
  }

  @Get('data-exports/:exportId/download')
  @RequirePermissions('users.security.manage')
  @LogDataAccess({ resource: 'user.data_export', resourceParam: 'exportId' })
  @ApiOperation({ summary: 'Download a ready export', description: 'Errors: DATA_EXPORT_NOT_FOUND' })
  @ApiParam({ name: 'exportId', format: 'uuid' })
  @ApiProduces('application/zip')
  async downloadDataExport(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('exportId', ParseUUIDPipe) exportId: string,
  ): Promise<StreamableFile> {
    const { stream, fileName } = await this.dataExportService.openForAdmin(userId, exportId);
    return new StreamableFile(stream, { type: 'application/zip', disposition: `attachment; filename="${fileName}"` });
  }
}
