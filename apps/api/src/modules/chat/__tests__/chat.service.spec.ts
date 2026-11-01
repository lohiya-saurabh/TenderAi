import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { eq } from 'drizzle-orm';
import { initDatabase } from '@/common/database/database.provider.js';
import { createDrizzle, type DrizzleDb } from '@/common/database/database.module.js';
import * as schema from '@/common/database/schema.js';
import { TenantContextHolder } from '@/common/security/TenantContext.js';
import { ChatService } from '../chat.service.js';
import { NotFoundError, BadRequestError } from '@/common/errors/errors.js';

describe('ChatService — Tenant Isolation & Anti-IDOR Suite', () => {
  let db: PGlite;
  let drizzleDb: DrizzleDb;
  let chatService: ChatService;

  const TENANT_A = 'org_acme_infra_001';
  const TENANT_B = 'org_bharat_002';
  const USER_A = 'usr_bid_mgr_01';
  const USER_B = 'usr_bharat_admin';
  let bidAId: string;

  beforeEach(async () => {
    db = new PGlite();
    await initDatabase(db, { seedUsers: true, seedFullProfile: true, seedBidsAndCompliance: true });
    drizzleDb = createDrizzle(db);
    chatService = new ChatService(drizzleDb);

    // Seed Tenant B user for Anti-IDOR testing
    await drizzleDb
      .insert(schema.organizations)
      .values({
        id: TENANT_B,
        name: 'Bharat Heavy Engineering Ltd.',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing();

    await drizzleDb
      .insert(schema.users)
      .values({
        id: USER_B,
        email: 'bharat@bharat.com',
        password: 'Password123!',
        name: 'Bharat User',
        role: 'admin',
        permissions: ['bids:read', 'bids:update'],
        organizationId: TENANT_B,
        organizationName: 'Bharat Heavy Engineering Ltd.',
      })
      .onConflictDoNothing();

    const [existingBid] = await drizzleDb
      .select({ id: schema.bids.id })
      .from(schema.bids)
      .where(eq(schema.bids.organizationId, TENANT_A))
      .limit(1);

    if (existingBid) {
      bidAId = existingBid.id;
    } else {
      bidAId = 'bid_expressway_001';
      await drizzleDb.insert(schema.bids).values({
        id: bidAId,
        organizationId: TENANT_A,
        companyId: 'comp_acme_infra_001',
        title: 'NHAI Expressway Expansion',
        status: 'REVIEW_READY',
      });
    }
  });

  it('should create conversation and exchange messages with citations and tool calls', async () => {
    TenantContextHolder.setFallback({
      organizationId: TENANT_A,
      userId: USER_A,
      role: 'ADMIN',
    });

    const response = await chatService.sendMessage({
      message: 'What is our 3-year average turnover according to our CA certificate?',
      bidId: bidAId,
    });

    expect(response.conversationId).toBeDefined();
    expect(response.message.role).toBe('assistant');
    expect(response.message.content).toContain('Financial Qualification');
    expect(response.message.citations).toHaveLength(2);
    expect(response.message.financialSummary).toBeDefined();
    expect(response.message.financialSummary?.verdict).toBe('PASS');
    expect(response.suggestedFollowups).toHaveLength(3);

    // Verify persisted conversation
    const conversations = await chatService.listConversations({ bidId: bidAId });
    expect(conversations).toHaveLength(1);
    expect(conversations[0].id).toBe(response.conversationId);

    // Verify persisted messages (user + assistant)
    const messages = await chatService.listMessages(response.conversationId);
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toContain('3-year average turnover');
    expect(messages[1].role).toBe('assistant');
    expect(messages[1].citations).toHaveLength(2);
  });

  it('should append follow-up message to the same conversation', async () => {
    TenantContextHolder.setFallback({
      organizationId: TENANT_A,
      userId: USER_A,
      role: 'ADMIN',
    });

    const firstRes = await chatService.sendMessage({
      message: 'Should we bid on this project?',
      bidId: bidAId,
    });

    const convId = firstRes.conversationId;

    const followUpRes = await chatService.sendMessage({
      conversationId: convId,
      message: 'What are the stamp paper and notarization rules?',
      bidId: bidAId,
    });

    expect(followUpRes.conversationId).toBe(convId);

    const allMessages = await chatService.listMessages(convId);
    expect(allMessages).toHaveLength(4); // User 1, Assistant 1, User 2, Assistant 2
    expect(allMessages[2].role).toBe('user');
    expect(allMessages[3].role).toBe('assistant');
  });

  it('throws BadRequestError when message is empty', async () => {
    TenantContextHolder.setFallback({
      organizationId: TENANT_A,
      userId: USER_A,
      role: 'ADMIN',
    });

    await expect(
      chatService.sendMessage({
        message: '   ',
        bidId: bidAId,
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it('Anti-IDOR: blocks Tenant B from querying Tenant A conversation', async () => {
    // 1. Tenant A creates conversation
    TenantContextHolder.setFallback({
      organizationId: TENANT_A,
      userId: USER_A,
      role: 'ADMIN',
    });

    const res = await chatService.sendMessage({
      message: 'Initial inquiry from Tenant A',
      bidId: bidAId,
    });
    const convId = res.conversationId;

    // 2. Tenant B attempts to read Tenant A conversation
    TenantContextHolder.setFallback({
      organizationId: TENANT_B,
      userId: USER_B,
      role: 'ADMIN',
    });

    await expect(chatService.getConversation(convId)).rejects.toThrow(NotFoundError);
    await expect(chatService.listMessages(convId)).rejects.toThrow(NotFoundError);
    await expect(
      chatService.sendMessage({
        conversationId: convId,
        message: 'Malicious injection from Tenant B',
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('Anti-IDOR: blocks Tenant B from creating conversation on Tenant A bid', async () => {
    TenantContextHolder.setFallback({
      organizationId: TENANT_B,
      userId: USER_B,
      role: 'ADMIN',
    });

    await expect(
      chatService.sendMessage({
        message: 'Attempting to inspect competitor bid',
        bidId: bidAId, // Belongs to Tenant A
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it('deletes conversation and cascades cleanly', async () => {
    TenantContextHolder.setFallback({
      organizationId: TENANT_A,
      userId: USER_A,
      role: 'ADMIN',
    });

    const res = await chatService.sendMessage({
      message: 'Temporary chat session',
      bidId: bidAId,
    });

    const deleteRes = await chatService.deleteConversation(res.conversationId);
    expect(deleteRes.success).toBe(true);

    const remaining = await chatService.listConversations({ bidId: bidAId });
    expect(remaining).toHaveLength(0);
  });

  it('handles concurrent chat queries across different bids in the same org with full thread isolation', async () => {
    TenantContextHolder.setFallback({
      organizationId: TENANT_A,
      userId: USER_A,
      role: 'ADMIN',
    });

    const bidBId = 'bid_metro_rail_002';
    await drizzleDb.insert(schema.bids).values({
      id: bidBId,
      organizationId: TENANT_A,
      companyId: 'comp_acme_infra_001',
      title: 'Kolkata Metro Rail Extension',
      status: 'REVIEW_READY',
    });

    // Execute concurrent queries for Bid A and Bid B
    const [resA, resB] = await Promise.all([
      chatService.sendMessage({
        message: 'What is the required turnover for Bid A?',
        bidId: bidAId,
      }),
      chatService.sendMessage({
        message: 'What are the similar experience requirements for Bid B?',
        bidId: bidBId,
      }),
    ]);

    expect(resA.conversationId).toBeDefined();
    expect(resB.conversationId).toBeDefined();
    expect(resA.conversationId).not.toBe(resB.conversationId);

    // Verify conversations are filtered strictly by bid
    const convsBidA = await chatService.listConversations({ bidId: bidAId });
    const convsBidB = await chatService.listConversations({ bidId: bidBId });

    expect(convsBidA.map((c) => c.id)).toContain(resA.conversationId);
    expect(convsBidA.map((c) => c.id)).not.toContain(resB.conversationId);

    expect(convsBidB.map((c) => c.id)).toContain(resB.conversationId);
    expect(convsBidB.map((c) => c.id)).not.toContain(resA.conversationId);

    // Verify messages in Bid A conversation don't leak into Bid B conversation
    const msgsA = await chatService.listMessages(resA.conversationId);
    const msgsB = await chatService.listMessages(resB.conversationId);

    expect(msgsA[0].content).toContain('Bid A');
    expect(msgsB[0].content).toContain('Bid B');
  });

  it('returns explicit lack of evidence and zero citations for adversarial out-of-domain queries', async () => {
    TenantContextHolder.setFallback({
      organizationId: TENANT_A,
      userId: USER_A,
      role: 'ADMIN',
    });

    const res = await chatService.sendMessage({
      message: 'What is the secret recipe for chocolate chip cookies in this highway tender?',
      bidId: bidAId,
    });

    expect(res.message.content).toContain('Anti-Hallucination Policy');
    expect(res.message.content).toContain('No verifiable evidence');
    expect(res.message.citations ?? []).toHaveLength(0);
    const uncertainties = (res.message.metadata?.uncertainties as Array<{ type: string }>) ?? [];
    expect(uncertainties.some((u) => u.type === 'LACK_OF_EVIDENCE')).toBe(true);
  });

  it('retrieves statutory GST credentials and company evidence without false lack-of-evidence rejection', async () => {
    TenantContextHolder.setFallback({
      organizationId: TENANT_A,
      userId: USER_A,
      role: 'ADMIN',
    });

    const res = await chatService.sendMessage({
      message: 'GST records',
      bidId: bidAId,
    });

    expect(res.message.role).toBe('assistant');
    expect(res.message.content).not.toContain('No verifiable evidence');
    expect(res.message.content).not.toContain('Anti-Hallucination Policy');
    // Acme Infrastructure seeded GSTIN: 27AABCU9603R1ZM
    expect(res.message.content).toContain('27AABCU9603R1ZM');
    expect(res.message.content).toContain('Acme Infrastructure Solutions Ltd');
    expect(res.message.content).toContain('GST_Registration_Certificate_Acme.pdf');
    expect(res.message.citations ?? []).not.toHaveLength(0);
    expect(res.message.citations?.[0].sourceType).toBe('COMPANY_EVIDENCE');
    expect(res.message.citations?.[0].documentName).toBe('GST_Registration_Certificate_Acme.pdf');
    expect(res.message.metadata?.intent).toBe('STATUTORY_CREDENTIALS');
  });

  it('resolves primary company evidence and statutory GSTIN when bidId and companyId are omitted', async () => {
    TenantContextHolder.setFallback({
      organizationId: TENANT_A,
      userId: USER_A,
      role: 'ADMIN',
    });

    const res = await chatService.sendMessage({
      message: 'What is our GST number?',
    });

    expect(res.message.role).toBe('assistant');
    expect(res.message.content).toContain('27AABCU9603R1ZM');
    expect(res.message.content).toContain('Acme Infrastructure Solutions Ltd');
    expect(res.message.citations?.[0].sourceType).toBe('COMPANY_EVIDENCE');
    expect(res.message.metadata?.intent).toBe('STATUTORY_CREDENTIALS');
  });

  it('responds conversationally to greetings without lack-of-evidence errors', async () => {
    TenantContextHolder.setFallback({
      organizationId: TENANT_A,
      userId: USER_A,
      role: 'ADMIN',
    });

    const res = await chatService.sendMessage({
      message: 'hello',
      bidId: bidAId,
    });

    expect(res.message.role).toBe('assistant');
    expect(res.message.content).toContain('TenderPulse AI Copilot');
    expect(res.message.content).not.toContain('No verifiable evidence');
    expect(res.message.metadata?.intent).toBe('GREETING');
    expect(res.suggestedFollowups.length).toBeGreaterThan(0);
  });
});
