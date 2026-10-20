import { relations } from 'drizzle-orm';
import { organizations, tenantSettings, subscriptions, usageRecords } from './tenants.js';
import { users, refreshTokens } from './auth.js';
import {
  companies,
  companyProfiles,
  companyProfileVersions,
  companyEvidenceDocuments,
  companyEvidenceChunks,
  evidenceVerificationHistory,
} from './companies.js';
import { bids, tenderDocuments, bidDecisions } from './bids.js';
import { complianceItems } from './compliance.js';
import { notifications, auditLogs } from './system.js';

export const organizationsRelations = relations(organizations, ({ many, one }) => ({
  users: many(users),
  companies: many(companies),
  bids: many(bids),
  tenantSettings: one(tenantSettings, {
    fields: [organizations.id],
    references: [tenantSettings.organizationId],
  }),
  subscriptions: many(subscriptions),
  usageRecords: many(usageRecords),
  notifications: many(notifications),
  auditLogs: many(auditLogs),
}));

export const tenantSettingsRelations = relations(tenantSettings, ({ one }) => ({
  organization: one(organizations, {
    fields: [tenantSettings.organizationId],
    references: [organizations.id],
  }),
  defaultCompany: one(companies, {
    fields: [tenantSettings.defaultCompanyId],
    references: [companies.id],
  }),
}));

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  organization: one(organizations, {
    fields: [subscriptions.organizationId],
    references: [organizations.id],
  }),
}));

export const usageRecordsRelations = relations(usageRecords, ({ one }) => ({
  organization: one(organizations, {
    fields: [usageRecords.organizationId],
    references: [organizations.id],
  }),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [users.organizationId],
    references: [organizations.id],
  }),
  refreshTokens: many(refreshTokens),
  notifications: many(notifications),
}));

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  bids: many(bids),
  evidenceDocuments: many(companyEvidenceDocuments),
  evidenceChunks: many(companyEvidenceChunks),
  profileVersions: many(companyProfileVersions),
  profile: one(companyProfiles, {
    fields: [companies.id],
    references: [companyProfiles.companyId],
  }),
}));

export const companyProfilesRelations = relations(companyProfiles, ({ one }) => ({
  company: one(companies, {
    fields: [companyProfiles.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [companyProfiles.organizationId],
    references: [organizations.id],
  }),
}));

export const companyProfileVersionsRelations = relations(companyProfileVersions, ({ one }) => ({
  company: one(companies, {
    fields: [companyProfileVersions.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [companyProfileVersions.organizationId],
    references: [organizations.id],
  }),
}));

export const companyEvidenceDocumentsRelations = relations(
  companyEvidenceDocuments,
  ({ one, many }) => ({
    company: one(companies, {
      fields: [companyEvidenceDocuments.companyId],
      references: [companies.id],
    }),
    organization: one(organizations, {
      fields: [companyEvidenceDocuments.organizationId],
      references: [organizations.id],
    }),
    chunks: many(companyEvidenceChunks),
    verificationHistory: many(evidenceVerificationHistory),
  }),
);

export const companyEvidenceChunksRelations = relations(companyEvidenceChunks, ({ one }) => ({
  evidenceDocument: one(companyEvidenceDocuments, {
    fields: [companyEvidenceChunks.evidenceDocumentId],
    references: [companyEvidenceDocuments.id],
  }),
  company: one(companies, {
    fields: [companyEvidenceChunks.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [companyEvidenceChunks.organizationId],
    references: [organizations.id],
  }),
}));

export const evidenceVerificationHistoryRelations = relations(
  evidenceVerificationHistory,
  ({ one }) => ({
    evidenceDocument: one(companyEvidenceDocuments, {
      fields: [evidenceVerificationHistory.evidenceDocumentId],
      references: [companyEvidenceDocuments.id],
    }),
    company: one(companies, {
      fields: [evidenceVerificationHistory.companyId],
      references: [companies.id],
    }),
    organization: one(organizations, {
      fields: [evidenceVerificationHistory.organizationId],
      references: [organizations.id],
    }),
  }),
);

export const bidsRelations = relations(bids, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [bids.organizationId],
    references: [organizations.id],
  }),
  company: one(companies, {
    fields: [bids.companyId],
    references: [companies.id],
  }),
  documents: many(tenderDocuments),
  complianceItems: many(complianceItems),
  decisions: many(bidDecisions),
}));

export const tenderDocumentsRelations = relations(tenderDocuments, ({ one }) => ({
  bid: one(bids, {
    fields: [tenderDocuments.bidId],
    references: [bids.id],
  }),
  organization: one(organizations, {
    fields: [tenderDocuments.organizationId],
    references: [organizations.id],
  }),
}));

export const complianceItemsRelations = relations(complianceItems, ({ one }) => ({
  bid: one(bids, {
    fields: [complianceItems.bidId],
    references: [bids.id],
  }),
  company: one(companies, {
    fields: [complianceItems.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [complianceItems.organizationId],
    references: [organizations.id],
  }),
}));

export const bidDecisionsRelations = relations(bidDecisions, ({ one }) => ({
  bid: one(bids, {
    fields: [bidDecisions.bidId],
    references: [bids.id],
  }),
  company: one(companies, {
    fields: [bidDecisions.companyId],
    references: [companies.id],
  }),
  organization: one(organizations, {
    fields: [bidDecisions.organizationId],
    references: [organizations.id],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  organization: one(organizations, {
    fields: [notifications.organizationId],
    references: [organizations.id],
  }),
  user: one(users, {
    fields: [notifications.recipientUserId],
    references: [users.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [auditLogs.organizationId],
    references: [organizations.id],
  }),
}));
