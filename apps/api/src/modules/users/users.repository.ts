import { Injectable, Inject } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import {
  DRIZZLE_TOKEN,
  type DrizzleDb,
  createDrizzle,
} from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';

@Injectable()
export class UsersRepository {
  private readonly db: DrizzleDb;

  constructor(@Inject(DRIZZLE_TOKEN) db: DrizzleDb | PGlite) {
    this.db = 'select' in db ? (db as DrizzleDb) : createDrizzle(db as PGlite);
  }

  public async findById(userId: string): Promise<schema.User | null> {
    const [user] = await this.db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    return user ?? null;
  }

  public async updateUser(
    userId: string,
    updates: Partial<schema.NewUser>,
  ): Promise<schema.User | null> {
    const [updated] = await this.db
      .update(schema.users)
      .set(updates)
      .where(eq(schema.users.id, userId))
      .returning();

    return updated ?? null;
  }

  public async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    await this.db
      .update(schema.users)
      .set({ password: newPasswordHash })
      .where(eq(schema.users.id, userId));
  }
}
