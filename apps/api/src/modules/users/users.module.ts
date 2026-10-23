/**
 * UsersModule — NestJS module for user profile and credentials.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { UsersService } from '@/modules/users/users.service.js';
import { UsersRepository } from '@/modules/users/users.repository.js';
import { UsersController } from '@/modules/users/users.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
