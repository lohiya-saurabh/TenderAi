/**
 * 0003 — one-time invite links for team members.
 *
 * An invited user gets an unusable password and a hashed, expiring invite token; accepting
 * the link sets their own password. Replaces the shared temporary password every invitee
 * used to get.
 */
import type { Migration } from './types.js';

export const migration0003UserInvites: Migration = {
  id: '0003_user_invites',
  sql: `
    ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_token_hash TEXT UNIQUE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;
  `,
};
