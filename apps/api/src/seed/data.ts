/**
 * Seed data constants — Demo users, Enterprise Company Capability Profile,
 * realistic Indian public procurement bid projects, grounded compliance items,
 * and deterministic bid decisions.
 */

// ─── Shared Type Definitions ────────────────────────────────────────────

export interface DemoCompany {
  id: string;
  organizationId: string;
  legalName: string;
  slug?: string;
  gstin?: string;
  pan?: string;
  udyamId?: string;
  constitution?: string;
  createdAt: string;
  updatedAt: string;
}

export const DEMO_COMPANIES: DemoCompany[] = [
  {
    id: 'comp_acme_infra_001',
    organizationId: 'org_acme_infra_001',
    legalName: 'Acme Infrastructure Solutions Ltd',
    slug: 'acme-infra',
    gstin: '27AABCU9603R1ZM',
    pan: 'AABCU9603R',
    udyamId: 'UDYAM-MH-12-0049281',
    constitution: 'PUBLIC_LIMITED',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'comp_acme_tech_002',
    organizationId: 'org_acme_infra_001',
    legalName: 'Acme Smart Systems & Surveillance Pvt Ltd',
    slug: 'acme-tech',
    gstin: '27AABCS4412Q1ZX',
    pan: 'AABCS4412Q',
    udyamId: 'UDYAM-MH-12-0088192',
    constitution: 'PRIVATE_LIMITED',
    createdAt: '2026-09-15T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
  {
    id: 'comp_bharat_heavy_001',
    organizationId: 'org_bharat_build_002',
    legalName: 'Bharat Heavy Infrastructure Enterprises Ltd',
    slug: 'bharat-heavy',
    gstin: '07AAACB2194P1Z8',
    pan: 'AAACB2194P',
    udyamId: 'UDYAM-DL-05-0012948',
    constitution: 'PUBLIC_LIMITED',
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
  },
];

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

export interface DemoExecutionRules {
  stampPaperRequired: boolean;
  stampPaperDenominationInr: number | null;
  notarizationRequired: boolean;
  udinRequired: boolean;
  signingAuthorityRank: string | null;
}

export interface DemoProvenance {
  documentId: string;
  documentName: string;
  pageNumber: number;
  sectionOrClause: string;
  verbatimQuote: string;
  confidenceScore: number;
}

export interface DemoCompanyEvidence {
  id: string;
  title: string;
  docType: string;
  documentName: string;
  status: 'VERIFIED' | 'SELF_ATTESTED' | 'EXPIRED' | 'MISSING' | 'PENDING_UPLOAD';
  udinNumber?: string;
  expiryDate?: string | null;
  notes?: string;
}

export interface DemoRequirementRisk {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category:
    | 'LIQUIDATED_DAMAGES'
    | 'WORKING_CAPITAL'
    | 'TIMELINE'
    | 'PAYMENT_TERMS'
    | 'LEGAL'
    | 'STATUTORY'
    | 'TECHNICAL'
    | 'FINANCIAL';
  summary: string;
  financialImpactRupees?: number;
  mitigation?: string;
}

export interface DemoAssessmentRationale {
  ruleApplied: string;
  tenderRequirement: string;
  companyCapability: string;
  comparisonResult: 'MET' | 'NOT_MET' | 'PARTIAL' | 'UNCLEAR';
  confidenceScore: number;
  details: string[];
}

export interface DemoComplianceItem {
  id: string;
  bidId: string;
  category:
    | 'LEGAL'
    | 'TECHNICAL'
    | 'FINANCIAL'
    | 'STATUTORY'
    | 'EXECUTION'
    | 'COMMERCIAL'
    | 'OPERATIONAL';
  title: string;
  requirement?: string;
  description: string;
  tenderClauseRef?: string;
  status:
    | 'PASS'
    | 'FAIL'
    | 'MISSING'
    | 'REVIEW_REQUIRED'
    | 'NOT_APPLICABLE'
    | 'PENDING'
    | 'READY'
    | 'FLAGGED'
    | 'WAIVED';
  humanReviewRequired: boolean;
  reviewNotes: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  version: number;
  executionRules: DemoExecutionRules;
  provenance: DemoProvenance;
  sourceCitation?: {
    document: string;
    page: number;
    section: string;
    verbatimQuote: string;
    confidenceScore: number;
  };
  companyEvidence?: DemoCompanyEvidence | null;
  risk?: DemoRequirementRisk | null;
  rationale?: DemoAssessmentRationale | null;
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
  companyId?: string;
  title: string;
  tenderNumber: string;
  tenderingAuthority: string;
  estimatedValueRupees: number;
  submissionDeadline: string | null;
  locationState: string | null;
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
      'bids:update',
      'bids:delete',
      'documents:upload',
      'compliance:read',
      'compliance:review',
      'audit:read',
      'company_profile:manage',
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

// ─── Enterprise Company Capability Profile Seed ─────────────────────────

export const DEMO_COMPANY_PROFILE_PAYLOAD = {
  company_name: 'Acme Infrastructure Solutions Ltd.',
  is_blacklisted: false,
  registrations: {
    gstin: '27AABCU9603R1ZM',
    pan: 'AABCU9603R',
    udyam: 'UDYAM-MH-01-0049281',
    gem_seller_id: 'GEM/2022/SELLER/84920',
    cpwd_class: 'Class-I (Super) Civil & Infrastructure',
    cin: 'L45200MH2012PLC234567',
  },
  operating_regions: [
    'Maharashtra',
    'Delhi NCR',
    'Karnataka',
    'Gujarat',
    'Tamil Nadu',
    'Uttar Pradesh',
    'Rajasthan',
  ],
  turnover_records: [
    {
      entry_id: 'to-fy25',
      financial_year: '2024-2025',
      turnover_inr_crores: 320.5,
      ca_udin: '25089745AAAAAA1234',
      evidence_document_id: 'doc-ev-ca-audited-fy25',
    },
    {
      entry_id: 'to-fy24',
      financial_year: '2023-2024',
      turnover_inr_crores: 285.0,
      ca_udin: '24089745AAAAAA5678',
      evidence_document_id: 'doc-ev-ca-audited-fy24',
    },
    {
      entry_id: 'to-fy23',
      financial_year: '2022-2023',
      turnover_inr_crores: 240.2,
      ca_udin: '23089745AAAAAA9012',
      evidence_document_id: 'doc-ev-ca-audited-fy23',
    },
  ],
  experience: [
    {
      entry_id: 'exp-pune-solapur-01',
      project_name: 'Four-laning of Pune-Solapur Highway Section (Km 45 to Km 88)',
      client_name: 'Maharashtra State Road Development Corporation (MSRDC)',
      contract_value_inr_crores: 185.4,
      completion_date: '2024-03-15',
      work_type_tags: ['Highway', 'EPC', 'Flexible Pavement', 'Bridges'],
      location_state: 'Maharashtra',
      evidence_document_id: 'doc-ev-work-order-msrdc-45',
    },
    {
      entry_id: 'exp-bengaluru-strr-02',
      project_name: 'Satellite Town Ring Road (STRR) Package-3 Construction',
      client_name: 'National Highways Authority of India (NHAI)',
      contract_value_inr_crores: 215.0,
      completion_date: '2023-11-20',
      work_type_tags: ['Expressway', 'Rigid Pavement', 'Grade Separators'],
      location_state: 'Karnataka',
      evidence_document_id: 'doc-ev-completion-nhai-strr',
    },
    {
      entry_id: 'exp-nagpur-interchange-03',
      project_name: 'Multimodal Logistics Park Interchange & Flyover Network',
      client_name: 'National Highways Logistics Management Ltd (NHLML)',
      contract_value_inr_crores: 95.8,
      completion_date: '2022-08-30',
      work_type_tags: ['Flyover', 'Civil Works', 'Drainage', 'ITS'],
      location_state: 'Maharashtra',
      evidence_document_id: 'doc-ev-completion-nhlml-nagpur',
    },
    {
      entry_id: 'exp-jaipur-bypass-04',
      project_name: 'Six-lane Northern Ring Road Elevated Corridor',
      client_name: 'Jaipur Development Authority (JDA)',
      contract_value_inr_crores: 142.6,
      completion_date: '2021-12-10',
      work_type_tags: ['Elevated Corridor', 'Prestressed Concrete', 'Lighting'],
      location_state: 'Rajasthan',
      evidence_document_id: 'doc-ev-completion-jda-jaipur',
    },
  ],
  certifications: [
    {
      entry_id: 'cert-iso-9001',
      standard_name: 'ISO 9001:2015 (Quality Management System)',
      issuing_body: 'Bureau Veritas Certification India',
      valid_from: '2023-01-15',
      valid_to: '2026-12-31',
      evidence_document_id: 'doc-ev-cert-iso-9001',
    },
    {
      entry_id: 'cert-iso-14001',
      standard_name: 'ISO 14001:2015 (Environmental Management System)',
      issuing_body: 'TUV SUD South Asia',
      valid_from: '2023-04-01',
      valid_to: '2026-12-31',
      evidence_document_id: 'doc-ev-cert-iso-14001',
    },
    {
      entry_id: 'cert-iso-45001',
      standard_name: 'ISO 45001:2018 (Occupational Health & Safety)',
      issuing_body: 'TUV SUD South Asia',
      valid_from: '2023-04-01',
      valid_to: '2026-12-31',
      evidence_document_id: 'doc-ev-cert-iso-45001',
    },
    {
      entry_id: 'cert-cmmi-dev-3',
      standard_name: 'CMMI-DEV v2.0 Maturity Level 3 (Smart Highway Systems)',
      issuing_body: 'SEI Authorized Partner Institute',
      valid_from: '2024-02-10',
      valid_to: '2027-02-09',
      evidence_document_id: 'doc-ev-cert-cmmi-3',
    },
  ],
  oem_authorizations: [
    {
      entry_id: 'oem-wirtgen-01',
      oem_name: 'Wirtgen Group India (Vögele & Hamm)',
      product_lines: ['Asphalt Pavers', 'Tandem Rollers', 'Soil Compactors'],
      valid_from: '2024-01-01',
      valid_to: '2027-12-31',
      evidence_document_id: 'doc-ev-maf-wirtgen-2024',
    },
    {
      entry_id: 'oem-schneider-02',
      oem_name: 'Schneider Electric India Pvt Ltd',
      product_lines: ['Highway SCADA', 'Substation Automation', 'Tunnel PLC'],
      valid_from: '2023-06-01',
      valid_to: '2026-06-30',
      evidence_document_id: 'doc-ev-maf-schneider-2023',
    },
    {
      entry_id: 'oem-honeywell-03',
      oem_name: 'Honeywell Building Solutions India',
      product_lines: ['CCTV Surveillance', 'Automatic Number Plate Recognition (ANPR)', 'VMS'],
      valid_from: '2024-03-15',
      valid_to: '2027-03-14',
      evidence_document_id: 'doc-ev-maf-honeywell-2024',
    },
  ],
  staff: [
    {
      entry_id: 'staff-01',
      name: 'Dr. Anandvardhan Rao, Ph.D. (Civil Engineering)',
      role: 'Chief Project Director & Technical Advisor',
      qualification: 'B.Tech (IIT Bombay), Ph.D. (Transportation Engineering)',
      experience_years: 26,
      evidence_document_id: 'doc-ev-cv-anandvardhan-rao',
    },
    {
      entry_id: 'staff-02',
      name: 'Sunil M. Deshmukh',
      role: 'Principal Highway & Pavement Engineer',
      qualification: 'M.Tech (Highway Infrastructure), COEP Pune',
      experience_years: 18,
      evidence_document_id: 'doc-ev-cv-sunil-deshmukh',
    },
    {
      entry_id: 'staff-03',
      name: 'Meenakshi Sundaram',
      role: 'Head of Quality Assurance & Materials Testing',
      qualification: 'B.E. (Civil), NABL Lead Auditor Certified',
      experience_years: 14,
      evidence_document_id: 'doc-ev-cv-meenakshi-sundaram',
    },
    {
      entry_id: 'staff-04',
      name: 'Col. Rajeshwar Singh (Retd.)',
      role: 'Chief Safety & Health Officer (HSE)',
      qualification: 'Diploma in Industrial Safety (CLI), NEBOSH IGC',
      experience_years: 22,
      evidence_document_id: 'doc-ev-cv-rajeshwar-singh',
    },
  ],
  equipment: [
    {
      entry_id: 'eq-paver-01',
      name: 'Vögele Super 1800-3i Tracked Asphalt Sensor Paver (9m Width)',
      equipment_type: 'Paving Machinery',
      quantity: 4,
      owned: true,
      evidence_document_id: 'doc-ev-rc-vogele-super1800',
    },
    {
      entry_id: 'eq-batch-02',
      name: 'Schwing Stetter Continuous Automatic Concrete Batching Plant (120 m³/hr)',
      equipment_type: 'Batching Plant',
      quantity: 3,
      owned: true,
      evidence_document_id: 'doc-ev-invoice-schwing-stetter',
    },
    {
      entry_id: 'eq-roller-03',
      name: 'Hamm HD 90+ Tandem Vibratory Soil & Bitumen Compactor',
      equipment_type: 'Compaction Equipment',
      quantity: 8,
      owned: true,
      evidence_document_id: 'doc-ev-rc-hamm-hd90',
    },
    {
      entry_id: 'eq-survey-04',
      name: 'Leica TS16 Robotic Total Station & RTK Dual GPS Survey System',
      equipment_type: 'Survey Equipment',
      quantity: 12,
      owned: true,
      evidence_document_id: 'doc-ev-invoice-leica-ts16',
    },
  ],
};

// ─── Live Tender Projects ───────────────────────────────────────────────

export const BIDS: DemoBid[] = [
  {
    id: 'bid-nhai-44-001',
    companyId: 'comp_acme_infra_001',
    title: 'Four-laning of NH-44 Bypass Section (Km 120.000 to Km 154.200) under EPC Mode',
    tenderNumber: 'NHAI/HQ/2026/EPC-4482',
    tenderingAuthority: 'National Highways Authority of India (NHAI)',
    estimatedValueRupees: 2450000000,
    submissionDeadline: '2026-11-15T15:00:00.000Z',
    locationState: 'Maharashtra',
    status: 'REVIEW_READY',
    totalRequirements: 7,
    flaggedRequirements: 1,
    approvedRequirements: 4,
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
      {
        id: 'doc-tech-04',
        fileName: 'Technical_Specifications_IRC_MoRTH_5th_Rev.pdf',
        fileSizeBytes: 7120400,
        mimeType: 'application/pdf',
        documentType: 'TECHNICAL_SPECS',
        status: 'EXTRACTED',
        uploadedAt: '2026-10-01T08:40:00.000Z',
      },
    ],
  },
  {
    id: 'bid-cpwd-gov-002',
    companyId: 'comp_acme_infra_001',
    title: 'Construction of Sustainable Central Government Administrative Complex (Phase 2)',
    tenderNumber: 'CPWD/DELHI/2026/CIVIL-0491',
    tenderingAuthority: 'Central Public Works Department (CPWD)',
    estimatedValueRupees: 1850000000,
    submissionDeadline: '2026-12-01T17:00:00.000Z',
    locationState: 'Delhi',
    status: 'ANALYZING',
    totalRequirements: 4,
    flaggedRequirements: 0,
    approvedRequirements: 0,
    createdAt: '2026-10-02T09:00:00.000Z',
    updatedAt: '2026-10-02T09:00:00.000Z',
    documents: [
      {
        id: 'doc-cpwd-nit',
        fileName: 'CPWD_NIT_Green_Building_Complex.pdf',
        fileSizeBytes: 3829104,
        mimeType: 'application/pdf',
        documentType: 'NIT',
        status: 'PROCESSING',
        uploadedAt: '2026-10-02T09:10:00.000Z',
      },
    ],
  },
  {
    id: 'bid-mha-surv-003',
    companyId: 'comp_acme_tech_002',
    title: 'City-Wide Integrated CCTV Surveillance & Traffic Command Centre (ICCC)',
    tenderNumber: 'MHA/SMARTCITY/2026/ITS-0118',
    tenderingAuthority: 'Smart Cities Mission & Municipal Corporation',
    estimatedValueRupees: 950000000,
    submissionDeadline: '2026-12-20T18:00:00.000Z',
    locationState: 'Karnataka',
    status: 'DRAFT',
    totalRequirements: 0,
    flaggedRequirements: 0,
    approvedRequirements: 0,
    createdAt: '2026-10-04T11:00:00.000Z',
    updatedAt: '2026-10-04T11:00:00.000Z',
    documents: [],
  },
];

// ─── Grounded Compliance Items Seed ─────────────────────────────────────

export const DEMO_COMPLIANCE_ITEMS: DemoComplianceItem[] = [
  {
    id: 'comp-nhai-001',
    bidId: 'bid-nhai-44-001',
    category: 'FINANCIAL',
    title: 'Minimum Average Annual Construction Turnover (Clause 2.2.2.2)',
    requirement: 'Minimum Average Annual Construction Turnover (Clause 2.2.2.2)',
    description:
      'The bidder must have achieved a minimum Average Annual Turnover of INR 150 Crores in the last 3 financial years (FY 2022-23, FY 2023-24, FY 2024-25), certified by a Chartered Accountant with valid ICAI UDIN.',
    status: 'PASS',
    humanReviewRequired: false,
    reviewNotes:
      'CA Certificate verified against UDIN 25089745AAAAAA1234. 3-Year average turnover is ₹281.90 Cr, exceeding the ₹150 Cr threshold by 87.9%.',
    reviewedBy: 'Vikramaditya Sharma',
    reviewedAt: '2026-10-02T10:00:00.000Z',
    version: 2,
    executionRules: {
      stampPaperRequired: false,
      stampPaperDenominationInr: null,
      notarizationRequired: false,
      udinRequired: true,
      signingAuthorityRank: 'Statutory Auditor / Chartered Accountant',
    },
    provenance: {
      documentId: 'doc-nit-01',
      documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
      pageNumber: 14,
      sectionOrClause:
        'Section II — Instructions to Bidders (ITB) Clause 2.2.2.2 (Financial Capacity)',
      verbatimQuote:
        'The Bidder shall have achieved a minimum Average Annual Construction Turnover of not less than Rs. 150.00 Crores (Rupees One Hundred Fifty Crores) during the last three financial years (2022-23 to 2024-25). This turnover must be certified by a practicing Chartered Accountant with a valid Unique Document Identification Number (UDIN).',
      confidenceScore: 0.98,
    },
    companyEvidence: {
      id: 'doc-ev-ca-audited-fy25',
      title: 'Audited Financial Statements & Turnover Certificate (3-Year Summary)',
      docType: 'FINANCIAL_AUDIT',
      documentName: 'CA_Audited_Turnover_Cert_FY25_Acme.pdf',
      status: 'VERIFIED',
      udinNumber: '25089745AAAAAA1234',
      expiryDate: null,
      notes:
        'Certified by M/s S.R. Batliboi & Associates, Chartered Accountants. 3-Year Avg: ₹281.90 Cr.',
    },
    risk: {
      level: 'LOW',
      category: 'FINANCIAL',
      summary:
        'Company turnover (₹281.90 Cr average) provides substantial 1.88x financial headroom.',
      financialImpactRupees: 0,
      mitigation:
        'Attach audited balance sheets and P&L schedules along with UDIN verification letter.',
    },
    rationale: {
      ruleApplied: 'THRESHOLD: TURNOVER_3YR_AVERAGE >= 150_000_000_INR',
      tenderRequirement: 'Minimum Average Annual Turnover of INR 150.00 Crores.',
      companyCapability: 'Achieved Average Turnover of INR 281.90 Crores over FY23, FY24, FY25.',
      comparisonResult: 'MET',
      confidenceScore: 0.99,
      details: [
        'FY 2024-25: ₹320.50 Crores',
        'FY 2023-24: ₹285.00 Crores',
        'FY 2022-23: ₹240.20 Crores',
        '3-Year Average: ₹281.90 Crores (Requirement: ₹150.00 Crores — Pass margin +87.9%)',
      ],
    },
    createdAt: '2026-10-01T08:45:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
  },
  {
    id: 'comp-nhai-002',
    bidId: 'bid-nhai-44-001',
    category: 'TECHNICAL',
    title: 'Similar Work Experience — 4-Lane Highway Construction (Clause 2.2.2.1)',
    requirement: 'Similar Work Experience — 4-Lane Highway Construction (Clause 2.2.2.1)',
    description:
      'The bidder must have successfully completed at least one similar EPC work of 4-laning/6-laning of National/State Highway of minimum value INR 120 Crores within the last 7 years.',
    status: 'PASS',
    humanReviewRequired: false,
    reviewNotes:
      'Verified against MSRDC Completion Certificate for Pune-Solapur Highway (₹185.40 Cr, 43.2 Km 4-lane EPC completed March 2024).',
    reviewedBy: 'Vikramaditya Sharma',
    reviewedAt: '2026-10-02T10:05:00.000Z',
    version: 2,
    executionRules: {
      stampPaperRequired: false,
      stampPaperDenominationInr: null,
      notarizationRequired: false,
      udinRequired: false,
      signingAuthorityRank: 'Superintending Engineer / Executive Engineer / GM (Technical)',
    },
    provenance: {
      documentId: 'doc-nit-01',
      documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
      pageNumber: 12,
      sectionOrClause: 'Section II — ITB Clause 2.2.2.1 (Technical Capacity — Similar Works)',
      verbatimQuote:
        'The Bidder must have successfully completed as a prime contractor at least one similar highway project consisting of 4-lane or 6-lane divided carriageway with bituminous/concrete surfacing of value not less than Rs. 120.00 Crores during the last 7 (seven) financial years.',
      confidenceScore: 0.96,
    },
    companyEvidence: {
      id: 'doc-ev-work-order-msrdc-45',
      title: 'MSRDC Final Completion Certificate — Pune-Solapur 4-Lane Bypass (Km 45-88)',
      docType: 'COMPLETION_CERTIFICATE',
      documentName: 'MSRDC_Completion_Cert_Pune_Solapur_Signed.pdf',
      status: 'VERIFIED',
      udinNumber: undefined,
      expiryDate: null,
      notes:
        'Completed in March 2024. Total executed value ₹185.40 Cr. Verified by Chief Engineer MSRDC.',
    },
    risk: {
      level: 'LOW',
      category: 'TECHNICAL',
      summary:
        'Pune-Solapur EPC project satisfies the 4-lane Highway threshold with 154% value clearance.',
      financialImpactRupees: 0,
      mitigation: 'Include client completion certificate and final bill summary.',
    },
    rationale: {
      ruleApplied: 'THRESHOLD: COMPLETED_SIMILAR_WORK_VALUE >= 120_000_000_INR within 7 years',
      tenderRequirement: 'One completed 4-lane highway project of minimum value INR 120.00 Crores.',
      companyCapability:
        'Completed Pune-Solapur Highway EPC of value INR 185.40 Crores in March 2024.',
      comparisonResult: 'MET',
      confidenceScore: 0.98,
      details: [
        'Executed Project: Pune-Solapur Highway Bypass (Km 45 to Km 88)',
        'Contract Value: ₹185.40 Crores (Required: ₹120.00 Crores)',
        'Scope: 4-lane divided flexible pavement carriageway with 3 major bridges',
        'Client: MSRDC (Govt of Maharashtra Undertaking)',
      ],
    },
    createdAt: '2026-10-01T08:45:00.000Z',
    updatedAt: '2026-10-02T10:05:00.000Z',
  },
  {
    id: 'comp-nhai-003',
    bidId: 'bid-nhai-44-001',
    category: 'LEGAL',
    title: 'Non-Blacklisting Affidavit on Non-Judicial Stamp Paper (Clause 1.4.3)',
    requirement: 'Non-Blacklisting Affidavit on Non-Judicial Stamp Paper (Clause 1.4.3)',
    description:
      'Affidavit sworn before a First Class Magistrate / Notary Public on Non-Judicial Stamp Paper of INR 500 stating that the bidder is not blacklisted or debarred by NHAI, MoRTH, or any Central/State Govt department.',
    status: 'REVIEW_REQUIRED',
    humanReviewRequired: true,
    reviewNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    version: 1,
    executionRules: {
      stampPaperRequired: true,
      stampPaperDenominationInr: 500,
      notarizationRequired: true,
      udinRequired: false,
      signingAuthorityRank: 'Managing Director / Authorized Director with Board Resolution',
    },
    provenance: {
      documentId: 'doc-nit-01',
      documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
      pageNumber: 8,
      sectionOrClause: 'Section I — NIT Clause 1.4.3 (Debarment & Disqualification)',
      verbatimQuote:
        'The Bidder shall submit an Affidavit on Non-Judicial Stamp Paper of Rs. 500/- (Rupees Five Hundred only), duly notarized by a Notary Public, affirming that the Bidder or any of its Directors/Partners have not been blacklisted, debarred, or declared ineligible by NHAI, MoRTH, or any Ministry of Government of India as on the Bid Due Date.',
      confidenceScore: 0.95,
    },
    companyEvidence: {
      id: 'doc-ev-affidavit-stamp',
      title: 'Company Non-Debarment Affidavit Form (Draft Template)',
      docType: 'AFFIDAVIT',
      documentName: 'Acme_Non_Blacklisting_Affidavit_Draft_2026.docx',
      status: 'NEEDS_REVIEW' as unknown as DemoCompanyEvidence['status'],
      udinNumber: undefined,
      expiryDate: '2026-11-15',
      notes:
        'Draft prepared. Needs execution on ₹500 Maharashtra e-Stamp paper and notarization before submission.',
    },
    risk: {
      level: 'HIGH',
      category: 'STATUTORY',
      summary:
        'Mandatory statutory clause. Non-submission or incorrect stamp paper denomination results in outright technical disqualification.',
      financialImpactRupees: 500,
      mitigation:
        'Execute affidavit on ₹500 e-Stamp paper in Mumbai and procure public notary seal 7 days before bid deadline.',
    },
    rationale: {
      ruleApplied: 'PRESENCE & EXECUTION_CHECK: NOTARIZED_AFFIDAVIT on INR 500 STAMP_PAPER',
      tenderRequirement:
        'Duly notarized Affidavit on INR 500 Non-Judicial Stamp Paper affirming non-blacklisting status.',
      companyCapability: 'Template drafted in legal repository; execution pending on stamp paper.',
      comparisonResult: 'UNCLEAR',
      confidenceScore: 0.85,
      details: [
        'Stamp Paper Denomination: ₹500 required',
        'Notarization: Mandatory (First Class Magistrate or Public Notary)',
        'Signatory: Authorized Director with certified Board Resolution copy',
        'Action Required: Human reviewer must verify final signed & scanned e-Stamp PDF',
      ],
    },
    createdAt: '2026-10-01T08:45:00.000Z',
    updatedAt: '2026-10-01T08:45:00.000Z',
  },
  {
    id: 'comp-nhai-004',
    bidId: 'bid-nhai-44-001',
    category: 'FINANCIAL',
    title: 'Bank Solvency Certificate / Net Worth (Clause 2.2.2.3)',
    requirement: 'Bank Solvency Certificate / Net Worth (Clause 2.2.2.3)',
    description:
      'Solvency Certificate issued by a Scheduled Commercial Bank for a minimum amount of INR 50 Crores, dated not earlier than 6 months from the bid submission deadline.',
    status: 'PASS',
    humanReviewRequired: false,
    reviewNotes:
      'State Bank of India Solvency Certificate of ₹75.00 Cr (dated 18-Aug-2026) verified and valid.',
    reviewedBy: 'Vikramaditya Sharma',
    reviewedAt: '2026-10-02T10:10:00.000Z',
    version: 2,
    executionRules: {
      stampPaperRequired: false,
      stampPaperDenominationInr: null,
      notarizationRequired: false,
      udinRequired: false,
      signingAuthorityRank: 'Assistant General Manager / Chief Manager (SBI Commercial Branch)',
    },
    provenance: {
      documentId: 'doc-nit-01',
      documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
      pageNumber: 15,
      sectionOrClause: 'Section II — ITB Clause 2.2.2.3 (Bank Solvency Certificate)',
      verbatimQuote:
        'The Bidder shall furnish a Solvency Certificate for an amount not less than Rs. 50.00 Crores issued by a Nationalized / Scheduled Commercial Bank in India, dated not earlier than 6 (six) months prior to the Bid Due Date.',
      confidenceScore: 0.97,
    },
    companyEvidence: {
      id: 'doc-ev-sbi-solvency-cert',
      title: 'State Bank of India — Bank Solvency Certificate (₹75.00 Cr)',
      docType: 'BANK_SOLVENCY',
      documentName: 'SBI_Solvency_Certificate_75Cr_Aug2026.pdf',
      status: 'VERIFIED',
      udinNumber: undefined,
      expiryDate: '2027-02-18',
      notes: 'Issued by SBI Special Commercial Branch, Fort, Mumbai. Value ₹75.00 Cr.',
    },
    risk: {
      level: 'LOW',
      category: 'FINANCIAL',
      summary:
        'SBI Solvency Certificate of ₹75 Cr exceeds ₹50 Cr requirement and is well within the 6-month validity window.',
      financialImpactRupees: 0,
      mitigation: 'Attach bank verification letter and contact details of the issuing AGM.',
    },
    rationale: {
      ruleApplied: 'THRESHOLD: BANK_SOLVENCY >= 500_000_000_INR & ISSUANCE_DATE <= 6_MONTHS',
      tenderRequirement:
        'Bank Solvency Certificate of at least INR 50.00 Crores issued within 6 months.',
      companyCapability: 'SBI Solvency Certificate of INR 75.00 Crores dated 18-August-2026.',
      comparisonResult: 'MET',
      confidenceScore: 0.99,
      details: [
        'Issuing Bank: State Bank of India (Scheduled Commercial Bank)',
        'Solvency Amount: ₹75.00 Crores (Required: ₹50.00 Crores)',
        'Date of Issue: 18-August-2026 (Valid until 18-February-2027)',
      ],
    },
    createdAt: '2026-10-01T08:45:00.000Z',
    updatedAt: '2026-10-02T10:10:00.000Z',
  },
  {
    id: 'comp-nhai-005',
    bidId: 'bid-nhai-44-001',
    category: 'EXECUTION',
    title: 'Key Plant & Machinery — Hydrostatic Sensor Pavers Availability (Schedule C)',
    requirement: 'Key Plant & Machinery — Hydrostatic Sensor Pavers Availability (Schedule C)',
    description:
      'Minimum ownership/leasehold of 2 units of Hydrostatic Sensor Pavers of minimum 9.0m width, not older than 5 years as on the bid submission date.',
    status: 'FAIL',
    humanReviewRequired: true,
    reviewNotes:
      'Company owns 4 Vögele Super 1800 pavers, but 2 units are deployed on Pune-Solapur maintenance until Jan 2027. Lease agreement needed for 1 additional unit.',
    reviewedBy: 'Vikramaditya Sharma',
    reviewedAt: '2026-10-02T10:15:00.000Z',
    version: 2,
    executionRules: {
      stampPaperRequired: false,
      stampPaperDenominationInr: null,
      notarizationRequired: false,
      udinRequired: false,
      signingAuthorityRank: 'Plant & Equipment In-Charge',
    },
    provenance: {
      documentId: 'doc-tech-04',
      documentName: 'Technical_Specifications_IRC_MoRTH_5th_Rev.pdf',
      pageNumber: 42,
      sectionOrClause: 'Schedule C — Plant & Machinery Requirements Clause 4.1',
      verbatimQuote:
        'The Contractor must mobilize and deploy at least 2 (two) numbers of computerized hydrostatic sensor pavers with screed width of 9.0 meters or more, manufactured not earlier than 2021, exclusively dedicated for the Bituminous Concrete (BC) wearing coat.',
      confidenceScore: 0.94,
    },
    companyEvidence: {
      id: 'doc-ev-rc-vogele-super1800',
      title: 'Equipment Ownership Invoices & RTO Registrations — Vögele Super 1800-3i',
      docType: 'EQUIPMENT_RC',
      documentName: 'Vogele_Super1800_RC_Book_Invoices.pdf',
      status: 'VERIFIED',
      udinNumber: undefined,
      expiryDate: null,
      notes: '4 owned units (2022 model). 2 units currently mobilized on active MSRDC site.',
    },
    risk: {
      level: 'HIGH',
      category: 'TECHNICAL',
      summary:
        'Site allocation conflict: only 2 pavers currently free, leaving zero redundancy in case of machine breakdown during paving season.',
      financialImpactRupees: 2500000,
      mitigation:
        'Execute standby equipment hire agreement with Wirtgen authorized rental partner prior to financial bid opening.',
    },
    rationale: {
      ruleApplied: 'COUNT & AGE_CHECK: SENSOR_PAVERS >= 2 & MFG_YEAR >= 2021 & UNCOMMITTED',
      tenderRequirement: '2 units of Hydrostatic Sensor Pavers (9m width) manufactured >= 2021.',
      companyCapability:
        '4 owned units (2022 model), but 2 currently committed to another project.',
      comparisonResult: 'PARTIAL',
      confidenceScore: 0.91,
      details: [
        'Owned Equipment: 4x Vögele Super 1800-3i (Manufactured 2022)',
        'Active Project Commitment: 2 units tied to Pune-Solapur Highway',
        'Available for NH-44: 2 units (Exact match, but zero buffer)',
      ],
    },
    createdAt: '2026-10-01T08:45:00.000Z',
    updatedAt: '2026-10-02T10:15:00.000Z',
  },
  {
    id: 'comp-nhai-006',
    bidId: 'bid-nhai-44-001',
    category: 'TECHNICAL',
    title: 'ISO 9001, ISO 14001, ISO 45001 Quality & Safety Compliance (Clause 3.1.8)',
    requirement: 'ISO 9001, ISO 14001, ISO 45001 Quality & Safety Compliance (Clause 3.1.8)',
    description:
      'Valid certification for ISO 9001 (QMS), ISO 14001 (EMS), and ISO 45001 (OH&S) from an accredited certification agency with validity extending beyond the tender submission date.',
    status: 'PASS',
    humanReviewRequired: false,
    reviewNotes:
      'All 3 ISO certificates verified with Bureau Veritas and TUV SUD. Valid until 31-Dec-2026.',
    reviewedBy: 'Priya Narayanan',
    reviewedAt: '2026-10-02T09:30:00.000Z',
    version: 2,
    executionRules: {
      stampPaperRequired: false,
      stampPaperDenominationInr: null,
      notarizationRequired: false,
      udinRequired: false,
      signingAuthorityRank: 'Lead Auditor / Quality Head',
    },
    provenance: {
      documentId: 'doc-nit-01',
      documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
      pageNumber: 22,
      sectionOrClause: 'Section III — General Conditions Clause 3.1.8 (Quality Assurance & Safety)',
      verbatimQuote:
        'The Bidder shall possess valid ISO 9001:2015, ISO 14001:2015, and ISO 45001:2018 certifications as on the Bid Due Date, issued by a certification body accredited by NABCB (National Accreditation Board for Certification Bodies) or IAF member.',
      confidenceScore: 0.99,
    },
    companyEvidence: {
      id: 'doc-ev-cert-iso-9001',
      title: 'Integrated Management System Certificates (ISO 9001, 14001, 45001)',
      docType: 'ISO_CERTIFICATE',
      documentName: 'Acme_ISO_9001_14001_45001_Bundle_2026.pdf',
      status: 'VERIFIED',
      udinNumber: undefined,
      expiryDate: '2026-12-31',
      notes: 'Accredited by NABCB / IAF. Valid through December 2026.',
    },
    risk: {
      level: 'LOW',
      category: 'STATUTORY',
      summary: 'All three ISO certificates are active and valid through end of 2026.',
      financialImpactRupees: 0,
      mitigation: 'Schedule ISO recertification audit in Q3 2026.',
    },
    rationale: {
      ruleApplied:
        'SET_MEMBERSHIP & VALIDITY: [ISO_9001, ISO_14001, ISO_45001] VALID >= SUBMISSION_DATE',
      tenderRequirement: 'Active ISO 9001, ISO 14001, and ISO 45001 certifications.',
      companyCapability: 'Holds all 3 certifications valid until 31-Dec-2026.',
      comparisonResult: 'MET',
      confidenceScore: 0.99,
      details: [
        'ISO 9001:2015: Valid until 31-Dec-2026 (Bureau Veritas)',
        'ISO 14001:2015: Valid until 31-Dec-2026 (TUV SUD)',
        'ISO 45001:2018: Valid until 31-Dec-2026 (TUV SUD)',
      ],
    },
    createdAt: '2026-10-01T08:45:00.000Z',
    updatedAt: '2026-10-02T09:30:00.000Z',
  },
  {
    id: 'comp-nhai-007',
    bidId: 'bid-nhai-44-001',
    category: 'FINANCIAL',
    title: 'Bid Security / Earnest Money Deposit (EMD) Bank Guarantee (Clause 1.3.1)',
    requirement: 'Bid Security / Earnest Money Deposit (EMD) Bank Guarantee (Clause 1.3.1)',
    description:
      'Bank Guarantee for Earnest Money Deposit of INR 2.45 Crores (1% of estimated value) issued by a Nationalized / Scheduled Commercial Bank with SFMS (Structured Financial Messaging System) message sent to NHAI beneficiary bank.',
    status: 'REVIEW_REQUIRED',
    humanReviewRequired: true,
    reviewNotes: null,
    reviewedBy: null,
    reviewedAt: null,
    version: 1,
    executionRules: {
      stampPaperRequired: true,
      stampPaperDenominationInr: 500,
      notarizationRequired: false,
      udinRequired: false,
      signingAuthorityRank: 'Chief Manager (Treasury & Trade Finance)',
    },
    provenance: {
      documentId: 'doc-nit-01',
      documentName: 'Notice_Inviting_Tender_Vol_I.pdf',
      pageNumber: 6,
      sectionOrClause: 'Section I — NIT Clause 1.3.1 (Bid Security / EMD Guarantee)',
      verbatimQuote:
        'The Bidder shall furnish, as part of its Bid, a Bid Security of Rs. 2,45,00,000/- (Rupees Two Crores Forty Five Lakhs only) in the form of an unconditional Bank Guarantee from a Scheduled Commercial Bank in the format provided in Appendix-IA. The BG must remain valid for 180 days beyond the Bid Due Date and must be transmitted via SFMS to ICICI Bank, NHAI HQ Branch (IFSC: ICIC0000007).',
      confidenceScore: 0.98,
    },
    companyEvidence: {
      id: 'doc-ev-bg-draft-hdfc',
      title: 'HDFC Bank Sanction Letter & Draft EMD Bank Guarantee (₹2.45 Cr)',
      docType: 'BANK_GUARANTEE',
      documentName: 'HDFC_Bank_EMD_BG_Draft_NHAI_44.pdf',
      status: 'NEEDS_REVIEW' as unknown as DemoCompanyEvidence['status'],
      udinNumber: undefined,
      expiryDate: '2027-05-15',
      notes:
        'Non-fund credit line approved with HDFC Bank. Draft BG vetted. SFMS message initiation pending.',
    },
    risk: {
      level: 'CRITICAL',
      category: 'FINANCIAL',
      summary:
        'SFMS transmission confirmation (MT760) is mandatory. Without the SFMS acknowledgement slip from beneficiary bank, the tender portal automatically rejects the bid during technical opening.',
      financialImpactRupees: 24500000,
      mitigation:
        'Authorize HDFC Bank treasury desk to transmit SFMS MT760 to NHAI ICICI IFSC code 3 days before submission deadline and collect bank acknowledgement receipt.',
    },
    rationale: {
      ruleApplied:
        'EXACT_MATCH: BANK_GUARANTEE_AMOUNT == 24_500_000_INR & SFMS_CONFIRMATION == TRUE',
      tenderRequirement:
        'Bank Guarantee of INR 2.45 Crores valid for 180 days with SFMS confirmation to ICICI Bank.',
      companyCapability:
        'HDFC Bank credit line sanctioned; draft BG prepared; final SFMS issuance pending.',
      comparisonResult: 'PARTIAL',
      confidenceScore: 0.92,
      details: [
        'Required EMD: ₹2,45,00,000 (1% of Estimated Cost ₹245.00 Cr)',
        'BG Validity Required: 180 days (Until 15-May-2027)',
        'Beneficiary SFMS: ICICI Bank, NHAI HQ Branch (ICIC0000007)',
        'Action Required: Human reviewer must verify final issued BG copy and SFMS transmission report',
      ],
    },
    createdAt: '2026-10-01T08:45:00.000Z',
    updatedAt: '2026-10-01T08:45:00.000Z',
  },
];

// ─── Initial Persisted Bid Decision Seed ────────────────────────────────

export const DEMO_BID_DECISION_SEED = {
  id: 'dec-nhai-44-001',
  bidId: 'bid-nhai-44-001',
  organizationId: 'org_acme_infra_001',
  profileVersionId: 'cpv-acme-v1',
  verdict: 'CONDITIONAL_GO',
  state: 'AI_PROPOSED',
  readinessScore: 0.865,
  response: {
    verdict: 'CONDITIONAL_GO',
    state: 'AI_PROPOSED',
    readiness_score: 0.865,
    reasons_to_pursue: [
      'Strong financial qualification: 3-year average turnover of ₹281.90 Cr exceeds the required ₹150.00 Cr by 87.9%.',
      'Direct similar work experience: Completed Pune-Solapur 4-Lane Highway EPC (₹185.40 Cr) satisfies the ₹120.00 Cr technical threshold.',
      'Active ISO 9001/14001/45001 management certifications valid throughout 2026.',
      'Bank Solvency of ₹75.00 Cr from State Bank of India exceeds the ₹50.00 Cr threshold.',
    ],
    reasons_not_to_pursue: [
      'Sensor Paver site allocation conflict: 2 out of 4 owned units are currently mobilized on another project.',
    ],
    uncertain_areas: [
      'Non-blacklisting affidavit on ₹500 non-judicial stamp paper must be notarized before bid submission.',
      'SFMS confirmation for ₹2.45 Cr EMD Bank Guarantee must be transmitted to ICICI Bank.',
    ],
    risk_summary: {
      critical_risks: 1,
      high_risks: 2,
      medium_risks: 1,
      low_risks: 3,
    },
  },
  createdAt: '2026-10-02T10:20:00.000Z',
};
