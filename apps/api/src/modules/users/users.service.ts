/**
 * UsersService — User profile and security management.
 */
import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { NotFoundError, BadRequestError, UnauthorizedError } from '@/common/errors/errors.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';

export interface UpdateUserProfileDto {
  name?: string;
  phone?: string;
}

export interface ChangePasswordDto {
  currentPassword?: string;
  newPassword?: string;
}

export interface UserProfileView {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  role: string;
  permissions: string[];
  organizationId: string;
  organizationName: string;
}

@Injectable()
export class UsersService {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  /**
   * Get current authenticated user profile.
   */
  public async getMe(): Promise<UserProfileView> {
    const userId = this.requireUserId();

    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundError(`User '${userId}' not found.`);
    }

    return this.mapUser(user);
  }

  /**
   * Update current authenticated user profile.
   */
  public async updateMe(dto: UpdateUserProfileDto): Promise<UserProfileView> {
    const userId = this.requireUserId();

    if (dto.name !== undefined && !dto.name.trim()) {
      throw new BadRequestError('Name cannot be empty.');
    }

    const updates: Partial<schema.NewUser> = {};
    if (dto.name !== undefined) updates.name = dto.name.trim();
    if (dto.phone !== undefined) updates.phone = dto.phone.trim() || null;

    const [updated] = await this.db
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, userId))
      .returning();

    if (!updated) {
      throw new NotFoundError(`User '${userId}' not found.`);
    }

    return this.mapUser(updated);
  }

  /**
   * Change user password with cryptographic bcrypt verification.
   */
  public async changePassword(
    dto: ChangePasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    const userId = this.requireUserId();

    if (!dto.currentPassword) {
      throw new BadRequestError('Current password is required.');
    }
    if (!dto.newPassword || dto.newPassword.length < 8) {
      throw new BadRequestError('New password must be at least 8 characters long.');
    }

    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundError(`User '${userId}' not found.`);
    }

    const isValid = await bcrypt.compare(dto.currentPassword, user.password);
    if (!isValid) {
      throw new UnauthorizedError('Current password is incorrect.');
    }

    const newHash = await bcrypt.hash(dto.newPassword, 10);

    await this.db
      .update(schema.users)
      .set({ password: newHash })
      .where(eq(schema.users.id, userId));

    return { success: true, message: 'Password updated successfully.' };
  }

  private mapUser(u: schema.User): UserProfileView {
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone ?? null,
      role: u.role,
      permissions: u.permissions ?? [],
      organizationId: u.organizationId,
      organizationName: u.organizationName,
    };
  }

  private requireUserId(): string {
    const userId = TenantContextHolder.get()?.userId;
    if (!userId) {
      throw new BadRequestError('Authentication context with userId is required.');
    }
    return userId;
  }
}
