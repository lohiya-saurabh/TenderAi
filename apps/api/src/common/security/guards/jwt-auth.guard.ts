/**
 * JwtAuthGuard — Global NestJS Guard for Cryptographic JWT Authentication
 *
 * Verifies Bearer tokens on every incoming request unless decorated with @Public().
 * Supports Authorization header ("Bearer <token>") and query param ("?token=<token>" for EventSource SSE).
 */

import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TokenService } from '../TokenService.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { UnauthorizedError } from '../../errors/errors.js';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
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

    // Support browser EventSource SSE connections passing token via query param as fallback
    if (!token && request.query?.token && typeof request.query.token === 'string') {
      token = request.query.token.trim();
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
