import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  uid: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext): AuthUser | string => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    if (data) {
      return user[data];
    }

    return user;
  }
);
