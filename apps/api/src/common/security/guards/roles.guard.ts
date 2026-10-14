/**
 * RolesGuard — Global NestJS Guard for Role-Based Access Control (RBAC)
 *
 * Verifies that the authenticated caller holds all required atomic permissions
 * declared via @RequirePermission(...).
 */

import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRED_PERMISSIONS_KEY } from '../decorators/permissions.decorator.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { hasPermission, type Permission } from '../permissions.js';
import type { UserTokenPayload } from '../TokenService.js';
import { UnauthorizedError, ForbiddenError } from '../../errors/errors.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: UserTokenPayload = request.user;

    if (!user) {
      throw new UnauthorizedError('User authentication required.');
    }

    for (const permission of requiredPermissions) {
      // Tokens may carry a '*' super-user wildcard, which is
      // not part of the Permission union — widen for the check.
      const granted = user.permissions as readonly string[];
      const hasPerm =
        (user.permissions && (granted.includes('*') || user.permissions.includes(permission))) ||
        hasPermission(user.role, permission);

      if (!hasPerm) {
        throw new ForbiddenError(`Role '${user.role}' lacks required permission '${permission}'.`);
      }
    }

    return true;
  }
}
