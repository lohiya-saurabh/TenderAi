/**
 * AuthModule — Authentication feature module.
 */
import { Module } from '@nestjs/common';
import { AuthController } from '@/modules/auth/auth.controller.js';
import { AuthService } from '@/modules/auth/auth.service.js';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
