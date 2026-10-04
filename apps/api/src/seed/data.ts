/**
 * Seed data constants — Demo users and initial bid projects.
 *
 * These are the type definitions and seed constants previously in server/data.ts.
 * Domain types used across modules are defined here until they graduate to
 * proper DDD value objects in each module's domain layer.
 */

// ─── Shared Type Definitions ────────────────────────────────────────────

export interface DemoUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  permissions: string[];
  organizationId: string;
  organizationName: string;
}

export interface DemoComplianceItem {
  id: string;
  bidId: string;
  category: 'LEGAL' | 'TECHNICAL' | 'FINANCIAL' | 'STATUTORY' | 'EXECUTION';
  title: string;
  description: string;
  status: 'PENDING' | 'READY' | 'FLAGGED' | 'WAIVED';
  humanReviewRequired: boolean;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  version: number;
  executionRules: {
    stampPaperRequired: boolean;
    stampPaperDenominationInr: number | null;
    notarizationRequired: boolean;
    udinRequired: boolean;
    signingAuthorityRank: string | null;
  };
  provenance: {
    documentId: string;
    documentName: string;
    pageNumber: number;
    sectionOrClause: string;
    verbatimQuote: string;
    confidenceScore: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface DemoAuditEvent {
  id: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  userId: string;
  userName: string;
  organizationId: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface DemoDocument {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  documentType: string;
  status: string;
  uploadedAt: string;
}

export interface DemoBid {
  id: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees: number;
  submissionDeadline: string | null;
  status: string;
  totalRequirements: number;
  flaggedRequirements: number;
  approvedRequirements: number;
  createdAt: string;
  updatedAt: string;
  documents: DemoDocument[];
}

// ─── Seed Constants ─────────────────────────────────────────────────────

export const DEMO_USERS: DemoUser[] = [
  {
    id: 'usr_bid_mgr_01',
    email: 'bidmanager@acme.com',
    password: 'Password123!',
    name: 'Vikramaditya Sharma',
    role: 'bid_manager',
    permissions: [
      'bids:read',
      'bids:create',
      'bids:edit',
      'documents:upload',
      'compliance:read',
      'compliance:review',
      'audit:read',
    ],
    organizationId: 'org_acme_infra_001',
    organizationName: 'Acme Infrastructure Solutions Ltd.',
  },
  {
    id: 'usr_comp_off_02',
    email: 'compliance@acme.com',
    password: 'Password123!',
    name: 'Priya Narayanan',
    role: 'compliance_officer',
    permissions: ['bids:read', 'compliance:read', 'compliance:review', 'audit:read'],
    organizationId: 'org_acme_infra_001',
    organizationName: 'Acme Infrastructure Solutions Ltd.',
  },
  {
    id: 'usr_auditor_03',
    email: 'auditor@acme.com',
    password: 'Password123!',
    name: 'Rajesh Kulkarni',
    role: 'auditor',
    permissions: ['bids:read', 'compliance:read', 'audit:read'],
    organizationId: 'org_acme_infra_001',
    organizationName: 'Acme Infrastructure Solutions Ltd.',
  },
];

export const BIDS: DemoBid[] = [
  {
    id: 'bid-nhai-44-001',
    title: 'Four-laning of NH-44 Bypass Section (Km 120.000 to Km 154.200) under EPC Mode',
    tenderNumber: 'NHAI/HQ/2026/EPC-4482',
    tenderingAuthority: 'National Highways Authority of India (NHAI)',
    estimatedValueRupees: 2450000000,
    submissionDeadline: '2026-11-15T15:00:00.000Z',
    status: 'REVIEW_READY',
    totalRequirements: 5,
    flaggedRequirements: 1,
    approvedRequirements: 2,
    createdAt: '2026-10-01T08:30:00.000Z',
    updatedAt: '2026-10-02T10:15:00.000Z',
    documents: [
      {
        id: 'doc-nit-01',
        fileName: 'Notice_Inviting_Tender_Vol_I.pdf',
        fileSizeBytes: 4829104,
        mimeType: 'application/pdf',
        documentType: 'NIT',
        status: 'EXTRACTED',
        uploadedAt: '2026-10-01T08:35:00.000Z',
      },
      {
        id: 'doc-boq-02',
        fileName: 'BOQ_Schedule_A_Rates.xlsx',
        fileSizeBytes: 1240960,
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        documentType: 'BOQ',
        status: 'EXTRACTED',
        uploadedAt: '2026-10-01T08:36:00.000Z',
      },
      {
        id: 'doc-corr-03',
        fileName: 'Corrigendum_01_PreBid_Queries.pdf',
        fileSizeBytes: 891230,
        mimeType: 'application/pdf',
        documentType: 'CORRIGENDUM',
        status: 'EXTRACTED',
        uploadedAt: '2026-10-01T14:20:00.000Z',
      },
    ],
  },
  {
    id: 'bid-cpwd-gov-002',
    title: 'Construction of Sustainable Central Government Administrative Complex (Phase 2)',
    tenderNumber: 'CPWD/DELHI/2026/CIVIL-0491',
    tenderingAuthority: 'Central Public Works Department (CPWD)',
    estimatedValueRupees: 1850000000,
    submissionDeadline: '2026-12-01T17:00:00.000Z',
    status: 'DRAFT',
    totalRequirements: 0,
    flaggedRequirements: 0,
    approvedRequirements: 0,
    createdAt: '2026-10-02T09:00:00.000Z',
    updatedAt: '2026-10-02T09:00:00.000Z',
    documents: [],
  },
];
