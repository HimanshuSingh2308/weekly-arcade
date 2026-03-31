import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);
  private readonly adminUids: Set<string>;

  constructor() {
    const uids = process.env.ADMIN_UIDS || '';
    this.adminUids = new Set(
      uids.split(',').map((uid) => uid.trim()).filter(Boolean)
    );
    if (this.adminUids.size === 0) {
      this.logger.warn('ADMIN_UIDS env var is empty — all admin endpoints will be blocked');
    }
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.uid || !this.adminUids.has(user.uid)) {
      this.logger.warn(`Unauthorized admin access attempt by uid: ${user?.uid}`);
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
