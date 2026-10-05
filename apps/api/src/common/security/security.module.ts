/**
 * SecurityModule — Global security configuration for TenderPulse AI
 *
 * Registers TokenService, global JwtAuthGuard, RolesGuard, and TenantContextInterceptor.
 */

import { Global, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TokenService } from './TokenService.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { TenantContextInterceptor } from './interceptors/tenant-context.interceptor.js';

@Global()
@Module({
  providers: [
    TokenService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TenantContextInterceptor,
    },
  ],
  exports: [TokenService],
})
export class SecurityModule {}
