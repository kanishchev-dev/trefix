import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { PaginatedResponseDto, PaginationDto } from '@/common/dto/pagination.dto';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { SystemEntityDeletionForbiddenException } from '@/common/exceptions/system-entity-deletion-forbidden.exception';
import { User } from '@/modules/users/entities/user.entity';

import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { UpdatePermissionGroupDto } from './dto/update-permission-group.dto';
import { Permission } from './entities/permission.entity';
import { PermissionGroup } from './entities/permission-group.entity';
import { PermissionCreatedEvent } from './events/permission-created.event';
import { PermissionDeletedEvent } from './events/permission-deleted.event';
import { PermissionGroupCreatedEvent } from './events/permission-group-created.event';
import { PermissionGroupDeletedEvent } from './events/permission-group-deleted.event';
import { PermissionGroupUpdatedEvent } from './events/permission-group-updated.event';
import { PermissionUpdatedEvent } from './events/permission-updated.event';
import { UserPermissionsUpdatedEvent } from './events/user-permissions-updated.event';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission)
    private permissionModel: typeof Permission,
    @InjectModel(PermissionGroup)
    private permissionGroupModel: typeof PermissionGroup,
    @InjectModel(User)
    private userModel: typeof User,
    private eventEmitter: EventEmitter2,
  ) {}

  // --- Permission CRUD ---

  /**
   * Creates a new atomic permission.
   * @param dto - Data to create permission
   * @returns Created permission entity
   */
  async createPermission(dto: CreatePermissionDto): Promise<Permission> {
    const permission = await this.permissionModel.create({ ...dto });

    this.eventEmitter.emit('permission.created', new PermissionCreatedEvent(permission.id, permission.name));

    return permission;
  }

  /**
   * Retrieves all available permissions.
   * @param pagination - Pagination options
   * @returns Paginated list of permissions
   */
  async findAllPermissions(pagination: PaginationDto = new PaginationDto()): Promise<PaginatedResponseDto<Permission>> {
    const { page = 1, limit = 10 } = pagination;
    const { rows, count } = await this.permissionModel.findAndCountAll({
      limit,
      offset: (page - 1) * limit,
    });

    return new PaginatedResponseDto(rows, count, page, limit);
  }

  /**
   * Finds a permission by its unique identifier.
   * @param id - Permission UUID
   * @returns Permission entity
   * @throws EntityNotFoundException if permission does not exist
   */
  async findPermission(id: string): Promise<Permission> {
    const permission = await this.permissionModel.findByPk(id);
    if (!permission) {
      throw new EntityNotFoundException('Permission', id);
    }
    return permission;
  }

  /**
   * Updates existing permission details.
   * @param id - Permission UUID
   * @param dto - Data to update
   * @returns Updated permission entity
   */
  async updatePermission(id: string, dto: UpdatePermissionDto): Promise<Permission> {
    const permission = await this.findPermission(id);
    const updatedPermission = await permission.update(dto);

    this.eventEmitter.emit(
      'permission.updated',
      new PermissionUpdatedEvent(updatedPermission.id, updatedPermission.name),
    );

    return updatedPermission;
  }

  /**
   * Soft deletes a permission.
   * @param id - Permission UUID
   */
  async removePermission(id: string): Promise<void> {
    const permission = await this.findPermission(id);
    const { name } = permission;
    await permission.destroy();

    this.eventEmitter.emit('permission.deleted', new PermissionDeletedEvent(id, name));
  }

  // --- PermissionGroup CRUD ---

  /**
   * Creates a new group for permissions.
   * @param dto - Group creation data
   * @returns Created permission group
   */
  async createGroup(dto: CreatePermissionGroupDto): Promise<PermissionGroup> {
    const group = await this.permissionGroupModel.create({ ...dto });

    this.eventEmitter.emit('permission-group.created', new PermissionGroupCreatedEvent(group.id, group.name));

    return group;
  }

  /**
   * Retrieves all permission groups.
   * @param pagination - Pagination options
   * @returns Paginated list of permission groups
   */
  async findAllGroups(pagination: PaginationDto = new PaginationDto()): Promise<PaginatedResponseDto<PermissionGroup>> {
    const { page = 1, limit = 10 } = pagination;
    const { rows, count } = await this.permissionGroupModel.findAndCountAll({
      limit,
      offset: (page - 1) * limit,
    });

    return new PaginatedResponseDto(rows, count, page, limit);
  }

  /**
   * Finds a permission group by ID.
   * @param id - Group UUID
   * @returns Permission group with its permissions
   */
  async findGroup(id: string): Promise<PermissionGroup> {
    const group = await this.permissionGroupModel.findByPk(id, {
      include: [Permission],
    });
    if (!group) {
      throw new EntityNotFoundException('PermissionGroup', id);
    }
    return group;
  }

  /**
   * Updates permission group details.
   * @param id - Group UUID
   * @param dto - Update data
   * @returns Updated group
   */
  async updateGroup(id: string, dto: UpdatePermissionGroupDto): Promise<PermissionGroup> {
    const group = await this.findGroup(id);
    const updatedGroup = await group.update(dto);

    this.eventEmitter.emit(
      'permission-group.updated',
      new PermissionGroupUpdatedEvent(updatedGroup.id, updatedGroup.name, 'updated'),
    );

    return updatedGroup;
  }

  /**
   * Deletes a permission group.
   * @param id - Group UUID
   */
  async removeGroup(id: string): Promise<void> {
    const group = await this.findGroup(id);
    if (group.isSystem) {
      throw new SystemEntityDeletionForbiddenException('permission group');
    }
    const { name } = group;
    await group.destroy();

    this.eventEmitter.emit('permission-group.deleted', new PermissionGroupDeletedEvent(id, name));
  }

  // --- Group Management ---

  /**
   * Adds a permission to a group.
   * @param groupId - Target group UUID
   * @param permissionId - Permission UUID to add
   */
  async addPermissionToGroup(groupId: string, permissionId: string): Promise<void> {
    const group = await this.findGroup(groupId);
    const permission = await this.findPermission(permissionId);
    await group.$add('permissions', permission);

    this.eventEmitter.emit(
      'permission-group.updated',
      new PermissionGroupUpdatedEvent(groupId, group.name, 'permission_added', permissionId),
    );
  }

  /**
   * Removes a permission from a group.
   * @param groupId - Target group UUID
   * @param permissionId - Permission UUID to remove
   */
  async removePermissionFromGroup(groupId: string, permissionId: string): Promise<void> {
    const group = await this.findGroup(groupId);
    const permission = await this.findPermission(permissionId);
    await group.$remove('permissions', permission);

    this.eventEmitter.emit(
      'permission-group.updated',
      new PermissionGroupUpdatedEvent(groupId, group.name, 'permission_removed', permissionId),
    );
  }

  // --- User Management ---

  /**
   * Assigns a permission group to a user.
   * @param userId - User UUID
   * @param groupId - Group UUID
   */
  async assignGroupToUser(userId: string, groupId: string): Promise<void> {
    const user = await this.userModel.findByPk(userId);
    if (!user) throw new EntityNotFoundException('User', userId);
    const group = await this.findGroup(groupId);
    await user.$add('permissionGroups', group);

    this.eventEmitter.emit(
      'user-permissions.updated',
      new UserPermissionsUpdatedEvent(userId, 'assign_group', groupId),
    );
  }

  /**
   * Revokes a permission group from a user.
   * @param userId - User UUID
   * @param groupId - Group UUID
   */
  async revokeGroupFromUser(userId: string, groupId: string): Promise<void> {
    const user = await this.userModel.findByPk(userId);
    if (!user) throw new EntityNotFoundException('User', userId);
    const group = await this.findGroup(groupId);
    await user.$remove('permissionGroups', group);

    this.eventEmitter.emit(
      'user-permissions.updated',
      new UserPermissionsUpdatedEvent(userId, 'revoke_group', groupId),
    );
  }

  /**
   * Assigns an individual permission to a user.
   * @param userId - User UUID
   * @param permissionId - Permission UUID
   */
  async assignPermissionToUser(userId: string, permissionId: string): Promise<void> {
    const user = await this.userModel.findByPk(userId);
    if (!user) throw new EntityNotFoundException('User', userId);
    const permission = await this.findPermission(permissionId);
    await user.$add('individualPermissions', permission);

    this.eventEmitter.emit(
      'user-permissions.updated',
      new UserPermissionsUpdatedEvent(userId, 'assign_permission', permissionId),
    );
  }

  /**
   * Revokes an individual permission from a user.
   * @param userId - User UUID
   * @param permissionId - Permission UUID
   */
  async revokePermissionFromUser(userId: string, permissionId: string): Promise<void> {
    const user = await this.userModel.findByPk(userId);
    if (!user) throw new EntityNotFoundException('User', userId);
    const permission = await this.findPermission(permissionId);
    await user.$remove('individualPermissions', permission);

    this.eventEmitter.emit(
      'user-permissions.updated',
      new UserPermissionsUpdatedEvent(userId, 'revoke_permission', permissionId),
    );
  }

  // --- Core Logic ---

  /**
   * Calculates the final list of permissions for a user, combining
   * individual assignments and rights from all assigned groups.
   * @param userId - User UUID
   * @returns Unique list of permission names
   */
  async getEffectivePermissions(userId: string): Promise<string[]> {
    const user = await this.userModel.findByPk(userId, {
      include: [
        {
          model: Permission,
          as: 'individualPermissions',
          attributes: ['name'],
        },
        {
          model: PermissionGroup,
          as: 'permissionGroups',
          include: [
            {
              model: Permission,
              as: 'permissions',
              attributes: ['name'],
            },
          ],
        },
      ],
    });

    if (!user) {
      throw new EntityNotFoundException('User', userId);
    }

    const permissionNames = new Set<string>();

    // Add individual permissions
    user.individualPermissions.forEach((p) => permissionNames.add(p.name));

    // Add permissions from groups
    user.permissionGroups.forEach((group) => {
      group.permissions.forEach((p) => permissionNames.add(p.name));
    });

    return Array.from(permissionNames);
  }
}
