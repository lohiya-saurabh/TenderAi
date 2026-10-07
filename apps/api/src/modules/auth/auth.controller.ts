/**
 * AuthController — NestJS controller for authentication endpoints.
 */
import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { Public } from '../../common/security/decorators/public.decorator.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: { email?: string; password?: string }) {
    return this.authService.login(body.email, body.password);
  }

  @Public()
  @Post('register')
  async register(
    @Body()
    body: {
      email?: string;
      password?: string;
      name?: string;
      organizationName?: string;
      companyName?: string;
      gstin?: string;
      pan?: string;
      udyamId?: string;
      locationState?: string;
    },
  ) {
    return this.authService.register({
      email: body?.email || '',
      password: body?.password || '',
      name: body?.name || '',
      organizationName: body?.organizationName,
      companyName: body?.companyName,
      gstin: body?.gstin,
      pan: body?.pan,
      udyamId: body?.udyamId,
      locationState: body?.locationState,
    });
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: { refreshToken?: string }) {
    return this.authService.refresh(body?.refreshToken);
  }
}
