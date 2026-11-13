import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { col, fn, Op, where as sequelizeWhere } from 'sequelize';

import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { SystemEntityDeletionForbiddenException } from '@/common/exceptions/system-entity-deletion-forbidden.exception';
import { PERMISSIONS_EVENTS } from '@/modules/permissions/permissions.events';

import { CreatePermissionDto } from './dto/create-permission.dto';
import { CreatePermissionGroupDto } from './dto/create-permission-group.dto';
import { PermissionQueryDto } from './dto/permission-query.dto';
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

@Injectable()
export class PermissionsService {
  constructor(
    @InjectModel(Permission)
    private permissionModel: typeof Permission,
    @InjectModel(PermissionGroup)
    private permissionGroupModel: typeof PermissionGroup,
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

    this.eventEmitter.emit(
      PERMISSIONS_EVENTS.PERMISSION_CREATED,
      new PermissionCreatedEvent(permission.id, permission.name),
    );

    return permission;
  }

  /**
   * Retrieves all available permissions.
   * @param query - Pagination and search options
   * @returns Paginated list of permissions
   */
  async findAllPermissions(
    query: PermissionQueryDto = new PermissionQueryDto(),
  ): Promise<PaginatedResponseDto<Permission>> {
    const { page = 1, limit = 10, search } = query;
    const { rows, count } = await this.permissionModel.findAndCountAll({
      where: this.buildTextFilter(['name', 'description'], search),
      // Deterministic order: without it, pagination can return overlapping
      // or missing rows, and the grouped settings UI would shuffle on refetch.
      order: [['name', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });

    return new PaginatedResponseDto(rows, count, page, limit);
  }

  /**
   * Retrieves the complete permission catalog without pagination.
   *
   * The admin group settings screen renders every permission as a toggle, so
   * it must never work off a truncated page of the paginated list.
   * @returns All permissions ordered by name
   */
  async findPermissionCatalog(): Promise<Permission[]> {
    return this.permissionModel.findAll({ order: [['name', 'ASC']] });
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
      PERMISSIONS_EVENTS.PERMISSION_UPDATED,
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

    this.eventEmitter.emit(PERMISSIONS_EVENTS.PERMISSION_DELETED, new PermissionDeletedEvent(id, name));
  }

  // --- PermissionGroup CRUD ---

  /**
   * Creates a new group for permissions.
   * @param dto - Group creation data
   * @returns Created permission group
   */
  async createGroup(dto: CreatePermissionGroupDto): Promise<PermissionGroup> {
    const group = await this.permissionGroupModel.create({ ...dto });

    this.eventEmitter.emit(PERMISSIONS_EVENTS.GROUP_CREATED, new PermissionGroupCreatedEvent(group.id, group.name));

    return group;
  }

  /**
   * Retrieves all permission groups.
   * @param query - Pagination and search options
   * @returns Paginated list of permission groups
   */
  async findAllGroups(
    query: PermissionQueryDto = new PermissionQueryDto(),
  ): Promise<PaginatedResponseDto<PermissionGroup>> {
    const { page = 1, limit = 10, search } = query;
    const { rows, count } = await this.permissionGroupModel.findAndCountAll({
      where: this.buildTextFilter(['name', 'description'], search),
      order: [['name', 'ASC']],
      limit,
      offset: (page - 1) * limit,
    });

    return new PaginatedResponseDto(rows, count, page, limit);
  }

  /**
   * Finds a permission group by ID including its permissions and members.
   * @param id - Group UUID
   * @returns Permission group with permissions and users
   */
  async findGroup(id: string): Promise<PermissionGroup> {
    const group = await this.permissionGroupModel.findByPk(id, {
      include: [
        { model: Permission, through: { attributes: [] } },
        {
          // Members are read through the entity association; the users module owns the table.
          association: 'users',
          through: { attributes: [] },
          attributes: ['id', 'firstName', 'lastName', 'email', 'isSystem'],
          required: false,
        },
      ],
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
      PERMISSIONS_EVENTS.GROUP_UPDATED,
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

    this.eventEmitter.emit(PERMISSIONS_EVENTS.GROUP_DELETED, new PermissionGroupDeletedEvent(id, name));
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
      PERMISSIONS_EVENTS.GROUP_UPDATED,
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
      PERMISSIONS_EVENTS.GROUP_UPDATED,
      new PermissionGroupUpdatedEvent(groupId, group.name, 'permission_removed', permissionId),
    );
  }

  /** Ids among the given that match no group; soft-deleted groups count as existing. */
  async findMissingGroupIds(ids: string[]): Promise<string[]> {
    const groups = await this.permissionGroupModel.findAll({ where: { id: ids }, attributes: ['id'], paranoid: false });
    const found = new Set(groups.map((group) => group.id));
    return [...new Set(ids)].filter((id) => !found.has(id));
  }

  /** Ids among the given that match no permission; soft-deleted permissions count as existing. */
  async findMissingPermissionIds(ids: string[]): Promise<string[]> {
    const permissions = await this.permissionModel.findAll({ where: { id: ids }, attributes: ['id'], paranoid: false });
    const found = new Set(permissions.map((permission) => permission.id));
    return [...new Set(ids)].filter((id) => !found.has(id));
  }

  /**
   * Builds a case-insensitive OR filter across the given columns.
   * Returns undefined when no search term is supplied so the query stays unfiltered.
   */
  private buildTextFilter(columns: readonly string[], search?: string): Record<string, unknown> | undefined {
    const term = search?.trim();
    if (!term) {
      return undefined;
    }

    // Escape LIKE wildcards so user input is matched literally.
    const pattern = `%${term.toLowerCase().replace(/[\\%_]/g, (match) => `\\${match}`)}%`;

    return {
      [Op.or]: columns.map((column) => sequelizeWhere(fn('lower', col(column)), { [Op.like]: pattern })),
    };
  }
}
