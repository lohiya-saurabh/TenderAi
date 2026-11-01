/**
 * AuthModule — NestJS module for authentication and tokens.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { AuthService } from '@/modules/auth/auth.service.js';
import { AuthRepository } from '@/modules/auth/auth.repository.js';
import { AuthController } from '@/modules/auth/auth.controller.js';
import { TokenService } from '@/common/security/TokenService.js';

@Module({
  imports: [DatabaseModule],
  controllers: [AuthController],
  providers: [AuthService, AuthRepository, TokenService],
  exports: [AuthService, AuthRepository, TokenService],
})
export class AuthModule {}
