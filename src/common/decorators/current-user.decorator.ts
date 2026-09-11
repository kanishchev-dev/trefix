import { createParamDecorator, ExecutionContext } from '@nestjs/common';

import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

export const CurrentUser = createParamDecorator(
  (_: unknown, context: ExecutionContext): AuthUserContext | undefined => {
    const request = context.switchToHttp().getRequest<{ user?: AuthUserContext }>();
    return request.user;
  },
);
