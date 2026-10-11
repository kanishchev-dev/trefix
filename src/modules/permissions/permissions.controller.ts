import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';

import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto';
import { PermissionQueryDto } from './dto/permission-query.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { UpdatePermissionGroupDto } from './dto/update-permission-group.dto';
import { Permission } from './entities/permission.entity';
import { PermissionGroup } from './entities/permission-group.entity';
import { PermissionsService } from './permissions.service';
import { UserPermissionsService } from './services/user-permissions.service';

/**
 * Route declaration order matters here: Express matches routes in the order
 * they were registered, so the literal `groups` collection routes have to be
 * declared before the `:id` route. Otherwise `GET /permissions/groups` is
 * swallowed by `GET /permissions/:id` and `ParseUUIDPipe` rejects it with 400.
 * Keep `permissions.controller.spec.ts` green when reordering.
 */
@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly userPermissionsService: UserPermissionsService,
  ) {}

  // --- Permissions: collection ---

  @Post()
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Create permission' })
  @ApiResponse({ status: 201, type: Permission })
  createPermission(@Body() dto: CreatePermissionDto): Promise<Permission> {
    return this.permissionsService.createPermission(dto);
  }

  @Get()
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  findAllPermissions(
    @Query() query: PermissionQueryDto = new PermissionQueryDto(),
  ): Promise<PaginatedResponseDto<Permission>> {
    return this.permissionsService.findAllPermissions(query);
  }

  @Get('catalog')
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Get the full permission catalog, unpaginated' })
  @ApiResponse({ status: 200, type: [Permission] })
  findPermissionCatalog(): Promise<Permission[]> {
    return this.permissionsService.findPermissionCatalog();
  }

  // --- Groups: collection (must precede the `:id` routes below) ---

  @Post('groups')
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Create permission group' })
  @ApiResponse({ status: 201, type: PermissionGroup })
  createGroup(@Body() dto: CreatePermissionGroupDto): Promise<PermissionGroup> {
    return this.permissionsService.createGroup(dto);
  }

  @Get('groups')
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Get all permission groups' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  findAllGroups(
    @Query() query: PermissionQueryDto = new PermissionQueryDto(),
  ): Promise<PaginatedResponseDto<PermissionGroup>> {
    return this.permissionsService.findAllGroups(query);
  }

  @Get('groups/:id')
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Get group by id' })
  @ApiResponse({ status: 200, type: PermissionGroup })
  findGroup(@Param('id', ParseUUIDPipe) id: string): Promise<PermissionGroup> {
    return this.permissionsService.findGroup(id);
  }

  // --- Permissions: single item ---

  @Get(':id')
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Get permission by id' })
  @ApiResponse({ status: 200, type: Permission })
  findPermission(@Param('id', ParseUUIDPipe) id: string): Promise<Permission> {
    return this.permissionsService.findPermission(id);
  }

  @Patch(':id')
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Update permission' })
  @ApiResponse({ status: 200, type: Permission })
  updatePermission(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePermissionDto): Promise<Permission> {
    return this.permissionsService.updatePermission(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('permissions.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete permission' })
  removePermission(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.permissionsService.removePermission(id);
  }

  // --- Groups: single item ---

  @Patch('groups/:id')
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Update group' })
  @ApiResponse({ status: 200, type: PermissionGroup })
  updateGroup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePermissionGroupDto): Promise<PermissionGroup> {
    return this.permissionsService.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  @RequirePermissions('permissions.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete group' })
  removeGroup(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.permissionsService.removeGroup(id);
  }

  // --- Assignments ---
  //
  // Every endpoint below answers 204 with an empty body. The previous implicit
  // 200/201 + empty body made the web client crash while parsing JSON, so the
  // status is now explicit and matches the other delete endpoints.

  @Post('groups/:groupId/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Add permission to group' })
  addPermissionToGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    return this.permissionsService.addPermissionToGroup(groupId, permissionId);
  }

  @Delete('groups/:groupId/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('permissions.manage')
  @ApiOperation({ summary: 'Remove permission from group' })
  removePermissionFromGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    return this.permissionsService.removePermissionFromGroup(groupId, permissionId);
  }

  @Post('users/:userId/groups/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Assign group to user' })
  assignGroupToUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<void> {
    return this.userPermissionsService.assignGroupToUser(userId, groupId);
  }

  @Delete('users/:userId/groups/:groupId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Revoke group from user' })
  revokeGroupFromUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<void> {
    return this.userPermissionsService.revokeGroupFromUser(userId, groupId);
  }

  @Post('users/:userId/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Assign individual permission to user' })
  assignPermissionToUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    return this.userPermissionsService.assignPermissionToUser(userId, permissionId);
  }

  @Delete('users/:userId/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('users.manage')
  @ApiOperation({ summary: 'Revoke individual permission from user' })
  revokePermissionFromUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    return this.userPermissionsService.revokePermissionFromUser(userId, permissionId);
  }

  @Get('users/:userId/effective')
  @RequirePermissions('permissions.read')
  @ApiOperation({ summary: 'Get effective permissions of a user' })
  @ApiResponse({ status: 200, type: [String] })
  getEffectivePermissions(@Param('userId', ParseUUIDPipe) userId: string): Promise<string[]> {
    return this.userPermissionsService.getEffectivePermissions(userId);
  }
}
