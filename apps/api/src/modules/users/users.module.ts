/**
 * UsersModule — NestJS module for user profile and credentials.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module.js';
import { UsersService } from './users.service.js';
import { UsersController } from './users.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
