/**
 * AuthController — NestJS controller for authentication endpoints.
 */
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Post('refresh')
  async refresh() {
    return this.authService.refresh();
  }
}
