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

import { PaginatedResponseDto, PaginationDto } from '@/common/dto/pagination.dto';

import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { UpdatePermissionGroupDto } from './dto/update-permission-group.dto';
import { Permission } from './entities/permission.entity';
import { PermissionGroup } from './entities/permission-group.entity';
import { PermissionsService } from './permissions.service';

@ApiTags('Permissions')
@ApiBearerAuth()
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  // --- Permissions ---

  @Post()
  @ApiOperation({ summary: 'Create permission' })
  @ApiResponse({ status: 201, type: Permission })
  createPermission(@Body() dto: CreatePermissionDto): Promise<Permission> {
    return this.permissionsService.createPermission(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all permissions' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  findAllPermissions(
    @Query() pagination: PaginationDto = new PaginationDto(),
  ): Promise<PaginatedResponseDto<Permission>> {
    return this.permissionsService.findAllPermissions(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get permission by id' })
  @ApiResponse({ status: 200, type: Permission })
  findPermission(@Param('id', ParseUUIDPipe) id: string): Promise<Permission> {
    return this.permissionsService.findPermission(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update permission' })
  @ApiResponse({ status: 200, type: Permission })
  updatePermission(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePermissionDto): Promise<Permission> {
    return this.permissionsService.updatePermission(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete permission' })
  removePermission(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.permissionsService.removePermission(id);
  }

  // --- Groups ---

  @Post('groups')
  @ApiOperation({ summary: 'Create permission group' })
  @ApiResponse({ status: 201, type: PermissionGroup })
  createGroup(@Body() dto: CreatePermissionGroupDto): Promise<PermissionGroup> {
    return this.permissionsService.createGroup(dto);
  }

  @Get('groups')
  @ApiOperation({ summary: 'Get all permission groups' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  findAllGroups(
    @Query() pagination: PaginationDto = new PaginationDto(),
  ): Promise<PaginatedResponseDto<PermissionGroup>> {
    return this.permissionsService.findAllGroups(pagination);
  }

  @Get('groups/:id')
  @ApiOperation({ summary: 'Get group by id' })
  @ApiResponse({ status: 200, type: PermissionGroup })
  findGroup(@Param('id', ParseUUIDPipe) id: string): Promise<PermissionGroup> {
    return this.permissionsService.findGroup(id);
  }

  @Patch('groups/:id')
  @ApiOperation({ summary: 'Update group' })
  @ApiResponse({ status: 200, type: PermissionGroup })
  updateGroup(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePermissionGroupDto): Promise<PermissionGroup> {
    return this.permissionsService.updateGroup(id, dto);
  }

  @Delete('groups/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete group' })
  removeGroup(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.permissionsService.removeGroup(id);
  }

  // --- Assignments ---

  @Post('groups/:groupId/permissions/:permissionId')
  @ApiOperation({ summary: 'Add permission to group' })
  addPermissionToGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    return this.permissionsService.addPermissionToGroup(groupId, permissionId);
  }

  @Delete('groups/:groupId/permissions/:permissionId')
  @ApiOperation({ summary: 'Remove permission from group' })
  removePermissionFromGroup(
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    return this.permissionsService.removePermissionFromGroup(groupId, permissionId);
  }

  @Post('users/:userId/groups/:groupId')
  @ApiOperation({ summary: 'Assign group to user' })
  assignGroupToUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<void> {
    return this.permissionsService.assignGroupToUser(userId, groupId);
  }

  @Delete('users/:userId/groups/:groupId')
  @ApiOperation({ summary: 'Revoke group from user' })
  revokeGroupFromUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ): Promise<void> {
    return this.permissionsService.revokeGroupFromUser(userId, groupId);
  }

  @Post('users/:userId/permissions/:permissionId')
  @ApiOperation({ summary: 'Assign individual permission to user' })
  assignPermissionToUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    return this.permissionsService.assignPermissionToUser(userId, permissionId);
  }

  @Delete('users/:userId/permissions/:permissionId')
  @ApiOperation({ summary: 'Revoke individual permission from user' })
  revokePermissionFromUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ): Promise<void> {
    return this.permissionsService.revokePermissionFromUser(userId, permissionId);
  }

  @Get('users/:userId/effective')
  @ApiOperation({ summary: 'Get effective permissions of a user' })
  @ApiResponse({ status: 200, type: [String] })
  getEffectivePermissions(@Param('userId', ParseUUIDPipe) userId: string): Promise<string[]> {
    return this.permissionsService.getEffectivePermissions(userId);
  }
}
