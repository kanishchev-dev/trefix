import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserPermissionsService } from '@/modules/permissions/services/user-permissions.service';

import { PERMISSIONS_KEY } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private userPermissionsService: UserPermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    // If no user is present, deny access (unless public, but AuthGuard should handle that)
    if (!user || !user.id) {
      return false;
    }

    const userPermissions = await this.userPermissionsService.getEffectivePermissions(user.id);

    return requiredPermissions.every((permission) => userPermissions.includes(permission));
  }
}
