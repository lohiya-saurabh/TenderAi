/**
 * TenderPulse AI — Local Development API Server
 *
 * Standalone HTTP server for local development and demonstration.
 * Backed by in-memory repositories with realistic Indian procurement domain data.
 */

import http from 'node:http';
import { URL } from 'node:url';

const PORT = Number(process.env.PORT) || 3000;

interface DemoUser {
  id: string;
  email: string;
  password: string;
  name: string;
  role: string;
  permissions: string[];
  organizationId: string;
  organizationName: string;
}

interface DemoComplianceItem {
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

interface DemoAuditEvent {
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

// Pre-configured Demo Users
const DEMO_USERS: DemoUser[] = [
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

// In-Memory Database State
const BIDS = [
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

const COMPLIANCE_ITEMS: Record<string, DemoComplianceItem[]> = {
  'bid-nhai-44-001': [
    {
      id: 'comp-01',
      bidId: 'bid-nhai-44-001',
      category: 'STATUTORY',
      title: 'Make in India (PPP-MII) Local Content Declaration',
      description:
        'Bidder must submit a formal declaration affirming Class-I Local Supplier status with minimum 50% local value addition, duly signed by Statutory Auditor.',
      status: 'READY',
      humanReviewRequired: true,
      reviewNotes: 'Verified against latest DPIIT Order P-45021/2/2017-PP (BE-II).',
      reviewedBy: 'Vikramaditya Sharma',
      reviewedAt: '2026-10-02T09:30:00.000Z',
      version: 2,
      executionRules: {
        stampPaperRequired: true,
        stampPaperDenominationInr: 100,
        notarizationRequired: true,
        udinRequired: true,
        signingAuthorityRank: 'Statutory Auditor / Authorized Director',
      },
      provenance: {
        documentId: 'doc-nit-01',
        documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
        pageNumber: 24,
        sectionOrClause: 'Clause 4.8.2 — Preference to Make in India',
        verbatimQuote:
          'The bidder shall submit an undertaking on Rs. 100/- non-judicial stamp paper attested by a Notary Public, and certificate from statutory auditor with UDIN confirming minimum 50% local content.',
        confidenceScore: 0.98,
      },
      createdAt: '2026-10-01T08:45:00.000Z',
      updatedAt: '2026-10-02T09:30:00.000Z',
    },
    {
      id: 'comp-02',
      bidId: 'bid-nhai-44-001',
      category: 'EXECUTION',
      title: 'Power of Attorney for Lead Member of Consortium',
      description:
        'Power of Attorney in favor of Lead Member executed on Non-Judicial Stamp paper of minimum ₹500 denomination, authenticated by Public Notary.',
      status: 'FLAGGED',
      humanReviewRequired: true,
      reviewNotes:
        'Flagged: Needs stamp paper from the state where registered office is located. Check state stamp act.',
      reviewedBy: 'Priya Narayanan',
      reviewedAt: '2026-10-02T10:05:00.000Z',
      version: 2,
      executionRules: {
        stampPaperRequired: true,
        stampPaperDenominationInr: 500,
        notarizationRequired: true,
        udinRequired: false,
        signingAuthorityRank: 'Board of Directors Resolution',
      },
      provenance: {
        documentId: 'doc-nit-01',
        documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
        pageNumber: 31,
        sectionOrClause: 'Clause 2.2.5 — Consortium Power of Attorney',
        verbatimQuote:
          'The Lead Member shall submit a Power of Attorney executed on non-judicial stamp paper of value not less than Rs. 500/-, duly notarized, accompanied by certified copy of Board Resolution.',
        confidenceScore: 0.96,
      },
      createdAt: '2026-10-01T08:45:00.000Z',
      updatedAt: '2026-10-02T10:05:00.000Z',
    },
    {
      id: 'comp-03',
      bidId: 'bid-nhai-44-001',
      category: 'FINANCIAL',
      title: 'Annual Turnover & Net Worth Certificate with UDIN',
      description:
        'Audited balance sheets and Net Worth certificate for past 5 financial years demonstrating minimum positive net worth of ₹120 Crore.',
      status: 'READY',
      humanReviewRequired: true,
      reviewNotes: 'Matches balance sheet figures for FY 2021-2025.',
      reviewedBy: 'Vikramaditya Sharma',
      reviewedAt: '2026-10-02T09:40:00.000Z',
      version: 2,
      executionRules: {
        stampPaperRequired: false,
        stampPaperDenominationInr: null,
        notarizationRequired: false,
        udinRequired: true,
        signingAuthorityRank: 'Practicing Chartered Accountant',
      },
      provenance: {
        documentId: 'doc-nit-01',
        documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
        pageNumber: 18,
        sectionOrClause: 'Clause 3.1.2 — Financial Capacity',
        verbatimQuote:
          'Net Worth of the Bidder as on 31st March of the previous financial year should be positive and not less than Rs. 120,00,00,000/-. All certificates issued by Chartered Accountants must bear valid UDIN.',
        confidenceScore: 0.99,
      },
      createdAt: '2026-10-01T08:45:00.000Z',
      updatedAt: '2026-10-02T09:40:00.000Z',
    },
    {
      id: 'comp-04',
      bidId: 'bid-nhai-44-001',
      category: 'TECHNICAL',
      title: 'Similar Work Experience in Highway Four-Laning',
      description:
        'Completed at least one similar EPC highway 4-laning project of minimum 20 km length valued at not less than ₹ 980 Crore in the last 7 years.',
      status: 'PENDING',
      humanReviewRequired: true,
      reviewNotes: null,
      reviewedBy: null,
      reviewedAt: null,
      version: 1,
      executionRules: {
        stampPaperRequired: false,
        stampPaperDenominationInr: null,
        notarizationRequired: false,
        udinRequired: false,
        signingAuthorityRank: 'Client Superintending Engineer / Project Director',
      },
      provenance: {
        documentId: 'doc-nit-01',
        documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
        pageNumber: 15,
        sectionOrClause: 'Clause 3.2.1 — Technical Threshold Capacity',
        verbatimQuote:
          'The Bidder must have successfully completed at least one 4-lane or 6-lane National Highway EPC project of continuous length not less than 20.00 Km with minimum project cost of Rs. 980.00 Cr.',
        confidenceScore: 0.97,
      },
      createdAt: '2026-10-01T08:45:00.000Z',
      updatedAt: '2026-10-01T08:45:00.000Z',
    },
    {
      id: 'comp-05',
      bidId: 'bid-nhai-44-001',
      category: 'LEGAL',
      title: 'Integrity Pact & Anti-Blacklisting Undertaking',
      description:
        'Signed Integrity Pact on non-judicial stamp paper pledging zero corrupt or fraudulent practices, and self-declaration of no debarment by MoRTH/NHAI.',
      status: 'PENDING',
      humanReviewRequired: true,
      reviewNotes: null,
      reviewedBy: null,
      reviewedAt: null,
      version: 1,
      executionRules: {
        stampPaperRequired: true,
        stampPaperDenominationInr: 100,
        notarizationRequired: true,
        udinRequired: false,
        signingAuthorityRank: 'Authorized Signatory with Board Resolution',
      },
      provenance: {
        documentId: 'doc-nit-01',
        documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
        pageNumber: 42,
        sectionOrClause: 'Appendix IX — Integrity Pact',
        verbatimQuote:
          'The Bidder shall submit the Integrity Pact duly signed and sealed on Rs. 100/- non-judicial stamp paper along with declaration of no active blacklisting or debarment by any PSU or Government Body.',
        confidenceScore: 0.99,
      },
      createdAt: '2026-10-01T08:45:00.000Z',
      updatedAt: '2026-10-01T08:45:00.000Z',
    },
  ],
};

const AUDIT_EVENTS: Record<string, DemoAuditEvent[]> = {
  'bid-nhai-44-001': [
    {
      id: 'aud-001',
      eventType: 'BID_PROJECT_CREATED',
      aggregateType: 'BidProject',
      aggregateId: 'bid-nhai-44-001',
      userId: 'usr_bid_mgr_01',
      userName: 'Vikramaditya Sharma',
      organizationId: 'org_acme_infra_001',
      payload: {
        tenderNumber: 'NHAI/HQ/2026/EPC-4482',
        estimatedValueRupees: 2450000000,
      },
      timestamp: '2026-10-01T08:30:00.000Z',
    },
    {
      id: 'aud-002',
      eventType: 'DOCUMENT_UPLOADED',
      aggregateType: 'TenderDocument',
      aggregateId: 'doc-nit-01',
      userId: 'usr_bid_mgr_01',
      userName: 'Vikramaditya Sharma',
      organizationId: 'org_acme_infra_001',
      payload: {
        fileName: 'Notice_Inviting_Tender_Vol_I.pdf',
        documentType: 'NIT',
        fileSizeBytes: 4829104,
      },
      timestamp: '2026-10-01T08:35:00.000Z',
    },
    {
      id: 'aud-003',
      eventType: 'AI_INGESTION_COMPLETED',
      aggregateType: 'BidProject',
      aggregateId: 'bid-nhai-44-001',
      userId: 'system_ai_worker',
      userName: 'TenderPulse AI Engine',
      organizationId: 'org_acme_infra_001',
      payload: {
        extractedItemsCount: 5,
        modelProvider: 'AWS Bedrock (Claude 3.5 Sonnet)',
        groundingScore: 0.98,
      },
      timestamp: '2026-10-01T08:45:00.000Z',
    },
    {
      id: 'aud-004',
      eventType: 'COMPLIANCE_ITEM_APPROVED',
      aggregateType: 'ComplianceItem',
      aggregateId: 'comp-01',
      userId: 'usr_bid_mgr_01',
      userName: 'Vikramaditya Sharma',
      organizationId: 'org_acme_infra_001',
      payload: {
        category: 'STATUTORY',
        previousStatus: 'PENDING',
        newStatus: 'READY',
      },
      timestamp: '2026-10-02T09:30:00.000Z',
    },
    {
      id: 'aud-005',
      eventType: 'COMPLIANCE_ITEM_FLAGGED',
      aggregateType: 'ComplianceItem',
      aggregateId: 'comp-02',
      userId: 'usr_comp_off_02',
      userName: 'Priya Narayanan',
      organizationId: 'org_acme_infra_001',
      payload: {
        category: 'EXECUTION',
        previousStatus: 'PENDING',
        newStatus: 'FLAGGED',
        notes: 'Needs stamp paper from registered office state.',
      },
      timestamp: '2026-10-02T10:05:00.000Z',
    },
  ],
};

const MAX_BODY_SIZE_BYTES = 1024 * 1024; // 1 MB

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    let totalBytes = 0;

    req.on('data', (chunk: Buffer | string) => {
      totalBytes += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
      if (totalBytes > MAX_BODY_SIZE_BYTES) {
        req.destroy();
        reject(new Error('Payload Too Large: Request body exceeds 1MB limit.'));
        return;
      }
      body += chunk;
    });

    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON in request body.'));
      }
    });

    req.on('error', reject);
  });
}


function sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  });
  res.end(payload);
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
    });
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  const method = req.method?.toUpperCase();

  try {
    // 1. Auth: Login
    if (method === 'POST' && pathname === '/api/v1/auth/login') {
      const { email, password } = await readJsonBody(req);
      const matched = DEMO_USERS.find(
        (u) => u.email.toLowerCase() === String(email || '').toLowerCase() && u.password === password,
      );

      if (!matched) {
        sendJson(res, 401, {
          message: 'Invalid email or password. Use demo credentials (e.g. bidmanager@acme.com / Password123!)',
        });
        return;
      }

      const { password: _, ...userProfile } = matched;
      const fakeJwt = `tp_demo_access_${Buffer.from(JSON.stringify(userProfile)).toString('base64url')}`;
      const fakeRefresh = `tp_demo_refresh_${userProfile.id}_${Date.now()}`;

      sendJson(res, 200, {
        accessToken: fakeJwt,
        refreshToken: fakeRefresh,
        user: userProfile,
      });
      return;
    }

    // 2. Auth: Refresh
    if (method === 'POST' && pathname === '/api/v1/auth/refresh') {
      const defaultUser = DEMO_USERS[0]!;
      const { password: _, ...userProfile } = defaultUser;
      const newJwt = `tp_demo_access_${Buffer.from(JSON.stringify(userProfile)).toString('base64url')}`;
      const newRefresh = `tp_demo_refresh_${userProfile.id}_${Date.now()}`;

      sendJson(res, 200, {
        accessToken: newJwt,
        refreshToken: newRefresh,
      });
      return;
    }

    // 3. Bids: List
    if (method === 'GET' && pathname === '/api/v1/bids') {
      sendJson(res, 200, BIDS);
      return;
    }

    // 4. Bids: Create
    if (method === 'POST' && pathname === '/api/v1/bids') {
      const body = await readJsonBody(req);
      const newBidId = `bid-${Date.now()}`;
      const newBid = {
        id: newBidId,
        title: body.title || 'Untitled Tender',
        tenderNumber: body.tenderNumber || `TNDR-${Date.now()}`,
        tenderingAuthority: body.tenderingAuthority || 'Government Authority',
        estimatedValueRupees: body.estimatedValueRupees || 0,
        submissionDeadline: body.submissionDeadline || null,
        status: 'DRAFT',
        totalRequirements: 0,
        flaggedRequirements: 0,
        approvedRequirements: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        documents: [],
      };
      BIDS.unshift(newBid);
      COMPLIANCE_ITEMS[newBidId] = [];
      AUDIT_EVENTS[newBidId] = [
        {
          id: `aud-${Date.now()}`,
          eventType: 'BID_PROJECT_CREATED',
          aggregateType: 'BidProject',
          aggregateId: newBidId,
          userId: 'usr_bid_mgr_01',
          userName: 'Vikramaditya Sharma',
          organizationId: 'org_acme_infra_001',
          payload: { title: newBid.title, tenderNumber: newBid.tenderNumber },
          timestamp: new Date().toISOString(),
        },
      ];

      sendJson(res, 201, {
        bidId: newBid.id,
        title: newBid.title,
        tenderNumber: newBid.tenderNumber,
        tenderingAuthority: newBid.tenderingAuthority,
        status: newBid.status,
        createdAt: newBid.createdAt,
      });
      return;
    }

    // 5. Bids: Get Single Detail
    const bidDetailMatch = pathname.match(/^\/api\/v1\/bids\/([^/]+)$/);
    if (method === 'GET' && bidDetailMatch) {
      const bidId = bidDetailMatch[1]!;
      const bid = BIDS.find((b) => b.id === bidId);
      if (!bid) {
        sendJson(res, 404, { message: `Bid project '${bidId}' not found.` });
        return;
      }
      sendJson(res, 200, bid);
      return;
    }

    // 6. Documents: Generate Presigned Upload URL
    const uploadUrlMatch = pathname.match(/^\/api\/v1\/bids\/([^/]+)\/upload-url$/);
    if (method === 'POST' && uploadUrlMatch) {
      const bidId = uploadUrlMatch[1]!;
      const body = await readJsonBody(req);
      const docId = `doc-${Date.now()}`;
      sendJson(res, 200, {
        documentId: docId,
        uploadUrl: `https://tenderpulse-localstack.s3.amazonaws.com/${bidId}/${docId}/${encodeURIComponent(
          body.fileName || 'document.pdf',
        )}?mock_presigned=true`,
        s3Key: `tenders/${bidId}/${docId}/${body.fileName || 'document.pdf'}`,
        expiresInSeconds: 900,
      });
      return;
    }

    // 7. Documents: Confirm Upload
    const confirmMatch = pathname.match(/^\/api\/v1\/bids\/([^/]+)\/documents\/confirm$/);
    if (method === 'POST' && confirmMatch) {
      const bidId = confirmMatch[1]!;
      const body = await readJsonBody(req);
      const bid = BIDS.find((b) => b.id === bidId);
      if (bid) {
        bid.status = 'ANALYZING';
        bid.updatedAt = new Date().toISOString();
        bid.documents.push({
          id: body.documentId || `doc-${Date.now()}`,
          fileName: 'Uploaded_Tender_Document.pdf',
          fileSizeBytes: 3500000,
          mimeType: 'application/pdf',
          documentType: 'NIT',
          status: 'EXTRACTED',
          uploadedAt: new Date().toISOString(),
        });
      }
      sendJson(res, 200, {
        documentId: body.documentId,
        status: 'UPLOADED',
      });
      return;
    }

    // 8. Documents: Download URL
    const downloadMatch = pathname.match(/^\/api\/v1\/bids\/([^/]+)\/documents\/([^/]+)\/download-url$/);
    if (method === 'GET' && downloadMatch) {
      sendJson(res, 200, {
        downloadUrl: `https://tenderpulse-localstack.s3.amazonaws.com/mock-download-url`,
        expiresInSeconds: 3600,
      });
      return;
    }

    // 9. Compliance: List Items
    const complianceListMatch = pathname.match(/^\/api\/v1\/bids\/([^/]+)\/compliance-items$/);
    if (method === 'GET' && complianceListMatch) {
      const bidId = complianceListMatch[1]!;
      const items = COMPLIANCE_ITEMS[bidId] ?? [];
      sendJson(res, 200, items);
      return;
    }

    // 10. Compliance: Patch Item (Review / Approve / Flag / Waive)
    const complianceItemMatch = pathname.match(/^\/api\/v1\/bids\/([^/]+)\/compliance-items\/([^/]+)$/);
    if (method === 'PATCH' && complianceItemMatch) {
      const bidId = complianceItemMatch[1]!;
      const itemId = complianceItemMatch[2]!;
      const body = await readJsonBody(req);

      const items = COMPLIANCE_ITEMS[bidId] ?? [];
      const item = items.find((i: DemoComplianceItem) => i.id === itemId);

      if (!item) {
        sendJson(res, 404, { message: `Compliance item '${itemId}' not found.` });
        return;
      }

      // Optimistic concurrency check
      if (body.expectedVersion != null && item.version !== body.expectedVersion) {
        sendJson(res, 409, {
          message: `Conflict: Item has been modified by another reviewer (Version ${item.version}). Please refresh.`,
        });
        return;
      }

      if (body.status) item.status = body.status;
      if (body.notes !== undefined) item.reviewNotes = body.notes;
      item.reviewedBy = 'Vikramaditya Sharma';
      item.reviewedAt = new Date().toISOString();
      item.version += 1;
      item.updatedAt = new Date().toISOString();

      // Recalculate summary metrics on bid
      const bid = BIDS.find((b) => b.id === bidId);
      if (bid) {
        bid.approvedRequirements = items.filter((i: DemoComplianceItem) => i.status === 'READY').length;
        bid.flaggedRequirements = items.filter((i: DemoComplianceItem) => i.status === 'FLAGGED').length;
        bid.totalRequirements = items.length;
        bid.updatedAt = new Date().toISOString();
      }

      // Record audit event
      if (!AUDIT_EVENTS[bidId]) {
        AUDIT_EVENTS[bidId] = [];
      }
      AUDIT_EVENTS[bidId]!.push({
        id: `aud-${Date.now()}`,
        eventType: `COMPLIANCE_ITEM_${item.status}`,
        aggregateType: 'ComplianceItem',
        aggregateId: item.id,
        userId: 'usr_bid_mgr_01',
        userName: 'Vikramaditya Sharma',
        organizationId: 'org_acme_infra_001',
        payload: {
          title: item.title,
          status: item.status,
          notes: item.reviewNotes,
          version: item.version,
        },
        timestamp: new Date().toISOString(),
      });

      sendJson(res, 200, {
        id: item.id,
        status: item.status,
        reviewNotes: item.reviewNotes,
        reviewedBy: item.reviewedBy,
        reviewedAt: item.reviewedAt,
        version: item.version,
      });
      return;
    }

    // 11. Audit: List Events
    const auditListMatch = pathname.match(/^\/api\/v1\/bids\/([^/]+)\/audit-events$/);
    if (method === 'GET' && auditListMatch) {
      const bidId = auditListMatch[1]!;
      const events = AUDIT_EVENTS[bidId] ?? [];
      sendJson(res, 200, events);
      return;
    }

    // 12. SSE: Realtime Document Extraction Progress Stream
    const sseMatch = pathname.match(/^\/api\/v1\/bids\/([^/]+)\/extraction-progress$/);
    if (method === 'GET' && sseMatch) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });

      const sendEvent = (eventData: unknown) => {
        res.write(`data: ${JSON.stringify(eventData)}\n\n`);
      };

      sendEvent({ step: 'PARSING_PDF', progress: 20, message: 'Normalizing PDF text blocks and tables...' });

      const t1 = setTimeout(() => {
        sendEvent({
          step: 'EXTRACTING_REQUIREMENTS',
          progress: 55,
          message: 'Executing LangGraph compliance workflow on Bedrock...',
        });
      }, 1000);

      const t2 = setTimeout(() => {
        sendEvent({
          step: 'VERIFYING_GROUNDEDNESS',
          progress: 85,
          message: 'Validating verbatim provenance against source text...',
        });
      }, 2000);

      const t3 = setTimeout(() => {
        sendEvent({
          step: 'COMPLETE',
          progress: 100,
          status: 'COMPLETED',
          message: 'Extraction completed. 5 compliance items identified.',
        });
      }, 3000);

      req.on('close', () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      });
      return;
    }

    // Route Not Found
    sendJson(res, 404, { message: `Route ${method} ${pathname} not found.` });
  } catch (err) {
    sendJson(res, 500, {
      message: err instanceof Error ? err.message : 'Internal server error',
    });
  }
});

server.listen(PORT, () => {
  console.log(`\n========================================================`);
  console.log(`🚀 TenderPulse AI API Server running at http://localhost:${PORT}`);
  console.log(`========================================================`);
  console.log(`📋 Demo Credentials:`);
  console.log(`   Bid Manager:         bidmanager@acme.com / Password123!`);
  console.log(`   Compliance Officer:  compliance@acme.com / Password123!`);
  console.log(`   Auditor:             auditor@acme.com    / Password123!`);
  console.log(`========================================================\n`);
});
