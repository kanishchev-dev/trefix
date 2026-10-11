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
import { ApiBearerAuth, ApiNoContentResponse, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { RealtimePresenceService } from '@/modules/realtime/services/realtime-presence.service';

import { AdminCreateUserDto } from './dto/admin-create-user.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { UserPresenceQueryDto } from './dto/user-presence-query.dto';
import { UserPresenceResponseDto } from './dto/user-presence-response.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { User } from './entities/user.entity';
import { AdminUsersService } from './services/admin-users.service';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@RequirePermissions('users.read')
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly adminUsersService: AdminUsersService,
    private readonly presenceService: RealtimePresenceService,
  ) {}

  @Post()
  @RequirePermissions('users.create')
  @ApiOperation({ summary: 'Create a user from the admin panel' })
  @ApiResponse({ status: 201, type: User })
  create(@Body() dto: AdminCreateUserDto): Promise<User> {
    return this.adminUsersService.createFromAdmin(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all users with search, sorting and pagination' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, type: String, example: 'DESC' })
  @ApiResponse({ status: 200, type: PaginatedResponseDto })
  findAll(@Query() query: UserQueryDto = new UserQueryDto()): Promise<PaginatedResponseDto<User>> {
    return this.usersService.findAll(query);
  }

  /**
   * Declared before `:id` on purpose: the route matcher would otherwise read
   * `presence` as a user id and reject it at the pipe.
   */
  @Get('presence')
  @ApiOperation({ summary: 'Report which of the given users currently hold a realtime connection' })
  @ApiResponse({ status: 200, type: UserPresenceResponseDto })
  async getPresence(@Query() query: UserPresenceQueryDto): Promise<UserPresenceResponseDto> {
    const onlineUserIds = await this.presenceService.onlineAmong(query.ids ?? []);

    return { onlineUserIds: [...onlineUserIds] };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get aggregated admin detail for a user' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<AdminUserResponseDto> {
    return this.adminUsersService.getAdminDetail(id);
  }

  @Patch(':id')
  @RequirePermissions('users.update')
  @ApiOperation({ summary: 'Update a user from the admin panel' })
  @ApiResponse({ status: 200, type: AdminUserResponseDto })
  async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AdminUpdateUserDto): Promise<AdminUserResponseDto> {
    await this.adminUsersService.updateFromAdmin(id, dto);
    return this.adminUsersService.getAdminDetail(id);
  }

  @Post(':id/invitations')
  @RequirePermissions('users.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Activation invite sent' })
  @ApiOperation({ summary: 'Send an activation invite to a passwordless user' })
  async createInvitation(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.adminUsersService.inviteFromAdmin(id);
  }

  @Delete(':id')
  @RequirePermissions('users.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 204, description: 'User deleted' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.adminUsersService.deleteFromAdmin(id);
  }
}
