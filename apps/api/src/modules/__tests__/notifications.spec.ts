/**
 * Notifications Integration & Security Test Suite
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { initDatabase } from '../../common/database/database.provider.js';
import * as schema from '../../common/database/schema.js';
import { TenantContextHolder } from '../../common/security/TenantContext.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { SettingsService } from '../settings/settings.service.js';
import { NotFoundError, BadRequestError } from '../../common/errors/errors.js';

describe('Notifications Integration & Preference Gating Suite', () => {
  let db: PGlite;
  let drizzleDb: ReturnType<typeof drizzle<typeof schema>>;
  let notificationsService: NotificationsService;
  let settingsService: SettingsService;

  const TENANT_A = 'org_acme_infra_001';
  const TENANT_B = 'org_bharat_build_002';
  const USER_A_MGR = 'usr_bid_mgr_01';

  beforeEach(async () => {
    db = new PGlite();
    await initDatabase(db, { seedUsers: true, seedFullProfile: true, seedBidsAndCompliance: true });
    drizzleDb = drizzle(db, { schema });

    notificationsService = new NotificationsService(drizzleDb as any);
    settingsService = new SettingsService(drizzleDb as any);
  });

  describe('1. Notifications Listing & Read State', () => {
    it('lists seeded notifications for tenant and calculates unread count', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_MGR, role: 'BID_MANAGER' },
        async () => {
          const result = await notificationsService.listNotifications();
          expect(result.notifications.length).toBeGreaterThan(0);
          expect(result.unreadCount).toBeGreaterThan(0);
          expect(result.notifications.every((n) => n.organizationId === TENANT_A)).toBe(true);
        },
      );
    });

    it('marks a single notification as read and updates readAt timestamp', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_MGR, role: 'BID_MANAGER' },
        async () => {
          const listBefore = await notificationsService.listNotifications({ unreadOnly: true });
          const unread = listBefore.notifications[0];
          expect(unread).toBeDefined();

          const marked = await notificationsService.markAsRead(unread!.id);
          expect(marked.isRead).toBe(true);
          expect(marked.readAt).not.toBeNull();
        },
      );
    });

    it('marks all unread notifications as read in bulk', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_MGR, role: 'BID_MANAGER' },
        async () => {
          const result = await notificationsService.markAllAsRead();
          expect(result.success).toBe(true);

          const after = await notificationsService.listNotifications();
          expect(after.unreadCount).toBe(0);
        },
      );
    });
  });

  describe('2. Preference Gating via tenant_settings', () => {
    it('successfully delivers notification when tenant preference is enabled', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_MGR, role: 'BID_MANAGER' },
        async () => {
          const res = await notificationsService.sendNotification({
            category: 'REVIEW_REQUEST',
            title: 'Action Needed: Compliance Verification',
            message: 'Please review technical compliance items.',
            priority: 'HIGH',
          });

          expect(res.delivered).toBe(true);
          expect(res.notification).toBeDefined();
          expect(res.notification?.title).toBe('Action Needed: Compliance Verification');
        },
      );
    });

    it('suppresses notification when tenant preference is disabled', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_MGR, role: 'BID_MANAGER' },
        async () => {
          // Disable deadline notifications for this tenant
          await settingsService.updateWorkspaceSettings({
            notificationPreferences: {
              notifyDeadlines: false,
              notifyEvidenceExpiry: true,
              notifyReviewRequests: true,
              notifyHighRiskFlags: true,
            },
          });

          const res = await notificationsService.sendNotification({
            category: 'DEADLINE',
            title: 'Urgent: Tender Closes Soon',
            message: 'Submission window closing.',
            priority: 'URGENT',
          });

          expect(res.delivered).toBe(false);
          expect(res.reason).toContain('SUPPRESSED_BY_TENANT_PREFERENCES');
        },
      );
    });
  });

  describe('3. Automated Deadline Scanner', () => {
    it('scans active bids and generates alerts for bids within 7 days', async () => {
      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_MGR, role: 'BID_MANAGER' },
        async () => {
          // Add a test bid with deadline 3 days from now
          const threeDaysLater = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
          await drizzleDb.insert(schema.bids).values({
            id: 'bid-urgent-001',
            organizationId: TENANT_A,
            companyId: 'comp_acme_infra_001',
            title: 'Urgent Railway Signaling EPC Tender',
            tenderNumber: 'RAIL/2026/SIG-991',
            tenderingAuthority: 'Indian Railways',
            estimatedValueRupees: 50000000,
            submissionDeadline: threeDaysLater,
            status: 'REVIEW_READY',
            totalRequirements: 5,
            flaggedRequirements: 0,
            approvedRequirements: 5,
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          const scanResult = await notificationsService.triggerDeadlineAndExpiryScan();
          expect(scanResult.scannedBids).toBeGreaterThan(0);
          expect(scanResult.notificationsCreated).toBeGreaterThanOrEqual(1);

          const list = await notificationsService.listNotifications({ unreadOnly: true });
          const created = list.notifications.find((n) => n.title.includes('RAIL/2026/SIG-991'));
          expect(created).toBeDefined();
          expect(created?.priority).toBe('HIGH');
        },
      );
    });
  });

  describe('4. Anti-IDOR Security & Isolation', () => {
    it('prevents cross-tenant notification access and read updates', async () => {
      let notifIdTenantA: string;

      await TenantContextHolder.run(
        { organizationId: TENANT_A, userId: USER_A_MGR, role: 'BID_MANAGER' },
        async () => {
          const list = await notificationsService.listNotifications();
          notifIdTenantA = list.notifications[0]!.id;
        },
      );

      await TenantContextHolder.run(
        { organizationId: TENANT_B, userId: 'usr_bharat_01', role: 'ADMIN' },
        async () => {
          await expect(notificationsService.markAsRead(notifIdTenantA)).rejects.toThrow(NotFoundError);
        },
      );
    });
  });
});
