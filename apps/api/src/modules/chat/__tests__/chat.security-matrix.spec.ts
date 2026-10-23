import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { initDatabase } from '@/common/database/database.provider.js';
import { createDrizzle, type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { ChatService } from '../chat.service.js';
import { NotFoundError } from '@/common/errors/errors.js';

describe('ChatService — Parameterized Multi-Tenant Security & Anti-IDOR Matrix', () => {
  let db: PGlite;
  let drizzleDb: DrizzleDb;
  let chatService: ChatService;

  const TENANTS = {
    ALPHA: 'org_tenant_alpha',
    BETA: 'org_tenant_beta',
    GAMMA: 'org_tenant_gamma',
  };

  const USERS = {
    USER_ALPHA: 'usr_alpha_01',
    USER_BETA: 'usr_beta_01',
    USER_GAMMA: 'usr_gamma_01',
  };

  const BIDS: Record<string, string> = {};

  beforeEach(async () => {
    db = new PGlite();
    await initDatabase(db, { seedUsers: true, seedFullProfile: true, seedBidsAndCompliance: true });
    drizzleDb = createDrizzle(db);
    chatService = new ChatService(drizzleDb);

    // Provision 3 separate enterprise organizations and users
    for (const [key, orgId] of Object.entries(TENANTS)) {
      await drizzleDb
        .insert(schema.organizations)
        .values({
          id: orgId,
          name: `${key} Infrastructure Corp`,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoNothing();

      const userKey = `USER_${key}` as keyof typeof USERS;
      const userId = USERS[userKey];

      await drizzleDb
        .insert(schema.users)
        .values({
          id: userId,
          email: `${key.toLowerCase()}@enterprise.com`,
          password: 'SecurePassword123!',
          name: `${key} Admin`,
          role: 'ADMIN',
          permissions: ['bids:read', 'bids:create', 'bids:update'],
          organizationId: orgId,
          organizationName: `${key} Infrastructure Corp`,
        })
        .onConflictDoNothing();

      // Provision a bid project for each tenant
      const bidId = `bid_${key.toLowerCase()}_project`;
      BIDS[orgId] = bidId;

      await drizzleDb
        .insert(schema.bids)
        .values({
          id: bidId,
          organizationId: orgId,
          companyId: `comp_${key.toLowerCase()}_001`,
          title: `${key} Highway Package EPC`,
          status: 'REVIEW_READY',
        })
        .onConflictDoNothing();
    }
  });

  // Cross-tenant access test matrix: 3 tenants x 2 cross-target tenants = 6 combinations
  const CROSS_TENANT_PAIRS = [
    { requesterOrg: TENANTS.ALPHA, requesterUser: USERS.USER_ALPHA, targetOrg: TENANTS.BETA, targetUser: USERS.USER_BETA },
    { requesterOrg: TENANTS.ALPHA, requesterUser: USERS.USER_ALPHA, targetOrg: TENANTS.GAMMA, targetUser: USERS.USER_GAMMA },
    { requesterOrg: TENANTS.BETA, requesterUser: USERS.USER_BETA, targetOrg: TENANTS.ALPHA, targetUser: USERS.USER_ALPHA },
    { requesterOrg: TENANTS.BETA, requesterUser: USERS.USER_BETA, targetOrg: TENANTS.GAMMA, targetUser: USERS.USER_GAMMA },
    { requesterOrg: TENANTS.GAMMA, requesterUser: USERS.USER_GAMMA, targetOrg: TENANTS.ALPHA, targetUser: USERS.USER_ALPHA },
    { requesterOrg: TENANTS.GAMMA, requesterUser: USERS.USER_GAMMA, targetOrg: TENANTS.BETA, targetUser: USERS.USER_BETA },
  ];

  for (const pair of CROSS_TENANT_PAIRS) {
    it(`Anti-IDOR: blocks ${pair.requesterOrg} from reading ${pair.targetOrg} conversation`, async () => {
      // 1. Target tenant creates a confidential conversation
      TenantContextHolder.setFallback({
        organizationId: pair.targetOrg,
        userId: pair.targetUser,
        role: 'ADMIN',
      });

      const convRes = await chatService.sendMessage({
        message: `Confidential tender inquiry inside ${pair.targetOrg}`,
        bidId: BIDS[pair.targetOrg],
      });
      const convId = convRes.conversationId;

      // 2. Requester tenant attempts to breach isolation
      TenantContextHolder.setFallback({
        organizationId: pair.requesterOrg,
        userId: pair.requesterUser,
        role: 'ADMIN',
      });

      // Assert getConversation throws NotFoundError
      await expect(chatService.getConversation(convId)).rejects.toThrow(NotFoundError);

      // Assert listMessages throws NotFoundError
      await expect(chatService.listMessages(convId)).rejects.toThrow(NotFoundError);

      // Assert cross-tenant message injection throws NotFoundError
      await expect(
        chatService.sendMessage({
          conversationId: convId,
          message: 'Malicious cross-tenant prompt injection',
        }),
      ).rejects.toThrow(NotFoundError);

      // Assert deleteConversation throws NotFoundError
      await expect(chatService.deleteConversation(convId)).rejects.toThrow(NotFoundError);
    });

    it(`Anti-IDOR: blocks ${pair.requesterOrg} from creating conversation on ${pair.targetOrg} bid`, async () => {
      TenantContextHolder.setFallback({
        organizationId: pair.requesterOrg,
        userId: pair.requesterUser,
        role: 'ADMIN',
      });

      await expect(
        chatService.sendMessage({
          message: 'Attempting to initiate chat on competitor bid',
          bidId: BIDS[pair.targetOrg],
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it(`Anti-IDOR: listConversations ignores targetOrg bidId when queried by ${pair.requesterOrg}`, async () => {
      TenantContextHolder.setFallback({
        organizationId: pair.requesterOrg,
        userId: pair.requesterUser,
        role: 'ADMIN',
      });

      await expect(
        chatService.listConversations({ bidId: BIDS[pair.targetOrg] }),
      ).rejects.toThrow(NotFoundError);
    });
  }
});
