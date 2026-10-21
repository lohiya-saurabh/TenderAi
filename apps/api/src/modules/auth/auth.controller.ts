/**
 * AuthController — NestJS controller for authentication endpoints with cookie security.
 */
import { Controller, Post, Body, Req, Res, HttpCode, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from '@/modules/auth/auth.service.js';
import { Public } from '@/common/security/decorators/public.decorator.js';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly authService: AuthService,
    @Optional() private readonly configService?: ConfigService,
  ) {}

  private extractCookie(req: Request, name: string): string | undefined {
    const cookieHeader = req.headers?.cookie;
    if (!cookieHeader) return undefined;
    const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
    return match ? decodeURIComponent(match[1]!) : undefined;
  }

  private setAuthCookies(res: Response, refreshToken: string, accessToken?: string): void {
    if (!res || typeof res.cookie !== 'function') return;
    const isProd = this.configService?.get<string>('NODE_ENV') === 'production';
    res.cookie('tp_refresh_token', refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 3600 * 1000,
    });
    if (accessToken) {
      res.cookie('tp_access_token', accessToken, {
        httpOnly: true,
        secure: isProd,
        sameSite: isProd ? 'strict' : 'lax',
        path: '/',
        maxAge: 3600 * 1000,
      });
    }
  }

  private clearAuthCookies(res: Response): void {
    if (!res || typeof res.clearCookie !== 'function') return;
    res.clearCookie('tp_refresh_token', { path: '/api/v1/auth' });
    res.clearCookie('tp_access_token', { path: '/' });
  }

  @Public()
  @Post('login')
  async login(
    @Body() body: { email?: string; password?: string },
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.authService.login(body.email, body.password);
    if (res) {
      this.setAuthCookies(res, result.refreshToken, result.accessToken);
    }
    return result;
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
    @Res({ passthrough: true }) res?: Response,
  ) {
    const result = await this.authService.register({
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
    if (res) {
      this.setAuthCookies(res, result.refreshToken, result.accessToken);
    }
    return result;
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Body() body: { refreshToken?: string },
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const incomingToken =
      body?.refreshToken || (req ? this.extractCookie(req, 'tp_refresh_token') : undefined);
    const result = await this.authService.refresh(incomingToken);
    if (res) {
      this.setAuthCookies(res, result.refreshToken, result.accessToken);
    }
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Body() body: { refreshToken?: string },
    @Req() req?: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const incomingToken =
      body?.refreshToken || (req ? this.extractCookie(req, 'tp_refresh_token') : undefined);
    if (incomingToken) {
      await this.authService.logout(incomingToken);
    }
    if (res) {
      this.clearAuthCookies(res);
    }
    return { success: true, message: 'Logged out successfully.' };
  }
}
