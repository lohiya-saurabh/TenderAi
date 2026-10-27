/**
 * JwtAuthGuard — Global NestJS Guard for Cryptographic JWT Authentication
 *
 * Verifies Bearer tokens on every incoming request unless decorated with @Public().
 * Accepts the Authorization header ("Bearer <token>") or the httpOnly tp_access_token cookie.
 * Tokens in query parameters are deliberately rejected: URLs end up in proxy and access
 * logs and browser history. The web client streams SSE over fetch with the Bearer header.
 */

import { Injectable, CanActivate, ExecutionContext, Inject } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '@/common/security/TokenService.js';
import { IS_PUBLIC_KEY } from '@/common/security/decorators/public.decorator.js';
import { UnauthorizedError } from '@/common/errors/errors.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(TokenService)
    private readonly tokenService: TokenService,
  ) {}

  public canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    let token: string | undefined;

    if (authHeader && typeof authHeader === 'string') {
      const match = authHeader.match(/^Bearer\s+(.+)$/i);
      if (match && match[1]) {
        token = match[1].trim();
      }
    }

    // Support httpOnly access token cookie
    if (!token && request.headers?.cookie) {
      const match = request.headers.cookie.match(/(?:^|;\s*)tp_access_token=([^;]+)/);
      if (match && match[1]) {
        token = decodeURIComponent(match[1]);
      }
    }

    if (!token) {
      throw new UnauthorizedError(
        'Missing or malformed Authorization header. Expected Bearer <token>.',
      );
    }

    const decodedUser = this.tokenService.verifyAccessToken(token);

    // Attach verified user claims to request for downstream guards and interceptors
    request.user = decodedUser;

    return true;
  }
}
