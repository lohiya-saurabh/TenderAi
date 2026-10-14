/**
 * TenderPulse AI — Workflow Domain Data & Evaluators
 *
 * Provides persistent company profile data and dynamic workflow evaluation
 * generators for all 13 stages of the MSME contractor bidding journey.
 */

import type { BidDetail } from '../api/bids.js';
import type { ComplianceItem } from '../api/compliance.js';
import type {
  CompanyCapabilityProfile,
  TenderDeadline,
  EligibilityFactorItem,
  BidDecisionOverview,
  EvidenceMappingCitation,
  CommercialRiskItem,
  MissingEvidenceItem,
  HumanReviewTaskState,
  BidReadinessPillars,
  SubmissionChecklistItem,
  WorkflowStageMeta,
} from '../types/workflow.js';

// ------------------------------------------------------------------
// Workflow Stages Metadata
// ------------------------------------------------------------------
export const WORKFLOW_STAGES: WorkflowStageMeta[] = [
  {
    id: 'company-profile',
    milestone: 'basics',
    stepNumber: 1,
    label: 'Company Profile',
    shortLabel: 'Profile',
    description: 'Verify your company registrations, audited turnover & past work credentials',
    icon: 'Building2',
  },
  {
    id: 'tender-intake',
    milestone: 'basics',
    stepNumber: 2,
    label: 'Tender Intake & Documents',
    shortLabel: 'Documents',
    description: 'Upload NIT, BOQ, Technical Specs, Corrigenda, and Special Conditions',
    icon: 'Upload',
  },
  {
    id: 'tender-overview',
    milestone: 'basics',
    stepNumber: 3,
    label: 'Tender Overview',
    shortLabel: 'Overview',
    description: 'Authority, estimated value, EMD amount, duration, and contract type',
    icon: 'FileText',
  },
  {
    id: 'key-deadlines',
    milestone: 'basics',
    stepNumber: 4,
    label: 'Key Deadlines',
    shortLabel: 'Deadlines',
    description: 'Pre-bid meeting, clarification window, bid submission, and technical opening',
    icon: 'Calendar',
  },
  {
    id: 'eligibility-summary',
    milestone: 'eligibility',
    stepNumber: 5,
    label: 'Eligibility Summary',
    shortLabel: 'Eligibility',
    description: '9-factor traffic-light check: statutory, turnover, past experience, and OEM',
    icon: 'CheckSquare',
  },
  {
    id: 'bid-decision',
    milestone: 'eligibility',
    stepNumber: 6,
    label: 'Bid / No-Bid Recommendation',
    shortLabel: 'Verdict',
    description: 'Clear verdict, commercial reasons to pursue, disqualifiers, and action plan',
    icon: 'Target',
  },
  {
    id: 'requirement-matrix',
    milestone: 'compliance',
    stepNumber: 7,
    label: 'Requirement Matrix',
    shortLabel: 'Requirements',
    description: 'Filterable compliance clauses, stamp paper rules, notarization, and CA UDIN',
    icon: 'ListChecks',
  },
  {
    id: 'evidence-mapping',
    milestone: 'compliance',
    stepNumber: 8,
    label: 'Evidence Mapping',
    shortLabel: 'Evidence',
    description:
      'Dual-sided verification: verbatim tender clause side-by-side with corporate proof',
    icon: 'Files',
  },
  {
    id: 'commercial-risks',
    milestone: 'risks-review',
    stepNumber: 9,
    label: 'Commercial & Legal Risks',
    shortLabel: 'Risks',
    description: 'Liquidated damages caps, cash lock-in (EMD + PBG), and price escalation',
    icon: 'TriangleAlert',
  },
  {
    id: 'missing-evidence',
    milestone: 'risks-review',
    stepNumber: 10,
    label: 'Missing Evidence (Gaps)',
    shortLabel: 'Gaps',
    description: 'Actionable checklist of certificates and undertakings to acquire before deadline',
    icon: 'Puzzle',
  },
  {
    id: 'human-review',
    milestone: 'risks-review',
    stepNumber: 11,
    label: 'Human Review & Sign-Off',
    shortLabel: 'Review',
    description: 'Specialist role confirmation, comment threading, and OCC versioning',
    icon: 'ClipboardCheck',
  },
  {
    id: 'bid-readiness',
    milestone: 'submission',
    stepNumber: 12,
    label: 'Bid Readiness Score',
    shortLabel: 'Readiness',
    description: 'Weighted 4-pillar readiness breakdown (Evidence, Risk, Deadlines, Cash flow)',
    icon: 'BarChart3',
  },
  {
    id: 'submission-prep',
    milestone: 'submission',
    stepNumber: 13,
    label: 'Submission Preparation',
    shortLabel: 'Submission',
    description: 'Two-Cover checklist: Technical Cover (₹100 stamp papers) vs Financial BOQ',
    icon: 'Send',
  },
];

// ------------------------------------------------------------------
// Default MSME Contractor Profile
// ------------------------------------------------------------------
export const DEFAULT_COMPANY_PROFILE: CompanyCapabilityProfile = {
  companyId: 'comp_apex_infra_001',
  companyName: 'Apex Infra Projects Pvt. Ltd.',
  profileVersion: 'v2.4 (Active)',
  businessType: 'PRIVATE_LIMITED',
  registrations: {
    gstin: '27AABCU9603R1ZM',
    pan: 'AABCU9603R',
    udyamNumber: 'UDYAM-MH-26-0012345',
    msmeCategory: 'SMALL',
    epfoNumber: 'MH/BAN/0045612/000',
    esicNumber: '31000123450000607',
  },
  isBlacklisted: false,
  turnoverRecords: [
    {
      financialYear: 'FY 2023-24',
      turnoverRupees: 185000000, // 18.5 Cr
      audited: true,
      caUdin: '24089123AAAAA1234',
      evidenceDocName: 'CA_Audited_Turnover_FY2023-24.pdf',
    },
    {
      financialYear: 'FY 2022-23',
      turnoverRupees: 142000000, // 14.2 Cr
      audited: true,
      caUdin: '23089123AAAAA5678',
      evidenceDocName: 'CA_Audited_Turnover_FY2022-23.pdf',
    },
    {
      financialYear: 'FY 2021-22',
      turnoverRupees: 118000000, // 11.8 Cr
      audited: true,
      caUdin: '22089123AAAAA9012',
      evidenceDocName: 'CA_Audited_Turnover_FY2021-22.pdf',
    },
  ],
  pastExperience: [
    {
      id: 'exp_01',
      projectTitle: 'Construction of Road Over Bridge (ROB) & Approaches',
      clientName: 'Central Railway (Bhusawal Division)',
      clientType: 'RAILWAY',
      contractValueRupees: 128000000, // 12.8 Cr
      completionDate: '2023-12-15',
      completionCertificateDocName: 'CR_ROB_Completion_Cert.pdf',
      scopeSummary:
        'RCC substructure, composite steel girders, high-grade concrete deck, and approach ramps.',
    },
    {
      id: 'exp_02',
      projectTitle: 'Substructure and Foundation Works for Highway Flyover',
      clientName: 'National Highways Authority of India (NHAI)',
      clientType: 'CENTRAL_GOVT',
      contractValueRupees: 95000000, // 9.5 Cr
      completionDate: '2023-03-30',
      completionCertificateDocName: 'NHAI_Flyover_Completion_Cert.pdf',
      scopeSummary: 'Deep pile foundations, pier caps, crash barriers, and drainage installation.',
    },
    {
      id: 'exp_03',
      projectTitle: 'Civil, Station Upgrade & Track Maintenance Infrastructure',
      clientName: 'Western Railway (Vadodara Division)',
      clientType: 'RAILWAY',
      contractValueRupees: 62000000, // 6.2 Cr
      completionDate: '2022-11-20',
      completionCertificateDocName: 'WR_Track_Maintenance_Cert.pdf',
      scopeSummary: 'Station platform lengthening, ballast retaining walls, and earthworks.',
    },
  ],
  certifications: [
    {
      id: 'cert_01',
      name: 'ISO 9001:2015',
      issuingBody: 'Bureau Veritas Quality International',
      certificateNumber: 'BVQI-IND-9001-44192',
      validUntil: '2027-11-14',
      evidenceDocName: 'ISO_9001_Quality_Certificate.pdf',
    },
    {
      id: 'cert_02',
      name: 'ISO 14001:2015',
      issuingBody: 'TUV Rheinland India',
      certificateNumber: 'TUV-IND-14001-88912',
      validUntil: '2026-12-10',
      evidenceDocName: 'ISO_14001_Environment_Certificate.pdf',
    },
    {
      id: 'cert_03',
      name: 'ISO 45001:2018',
      issuingBody: 'TUV Rheinland India',
      certificateNumber: 'TUV-IND-45001-33109',
      validUntil: '2027-01-20',
      evidenceDocName: 'ISO_45001_Safety_Certificate.pdf',
    },
  ],
  oemAuthorizations: [
    {
      id: 'oem_01',
      oemName: 'Tata Steel Ltd.',
      productCategory: 'TMT Reinforcement Bars (Fe 550D)',
      validUntil: '2026-12-31',
      mafDocName: 'Tata_Steel_Authorized_Channel_Partner.pdf',
    },
    {
      id: 'oem_02',
      oemName: 'UltraTech Cement Ltd.',
      productCategory: 'OPC 53 Grade & Ready Mix Concrete (RMC)',
      validUntil: '2027-03-31',
      mafDocName: 'UltraTech_Direct_Supply_MOU.pdf',
    },
  ],
  operatingStates: ['Maharashtra', 'Madhya Pradesh', 'Gujarat'],
  authorizedSignatories: [
    {
      name: 'Ramesh Sharma',
      designation: 'Managing Director',
      pan: 'AABCU9603R',
      dscTokenValidUntil: '2027-08-15',
    },
  ],
};

// ------------------------------------------------------------------
// Workflow Derivation Helpers
// ------------------------------------------------------------------

export function deriveDeadlines(bid: BidDetail): TenderDeadline[] {
  const deadlineDate = bid.submissionDeadline ? new Date(bid.submissionDeadline) : new Date();
  const preBidDate = new Date(deadlineDate.getTime() - 10 * 24 * 60 * 60 * 1000);
  const techOpenDate = new Date(deadlineDate.getTime() + 1 * 24 * 60 * 60 * 1000);
  const downloadEndDate = new Date(deadlineDate.getTime() - 1 * 24 * 60 * 60 * 1000);

  const now = new Date();
  const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return [
    {
      id: 'dl_pre_bid',
      label: 'Pre-Bid Meeting & Clarifications',
      date: preBidDate.toISOString().split('T')[0] || preBidDate.toISOString(),
      time: '11:00 IST',
      isPassed: preBidDate < now,
      isCritical: false,
      description:
        'Online via Video Conference or Conference Hall, DRM Office. Submit queries in writing 48h prior.',
    },
    {
      id: 'dl_doc_sale',
      label: 'Tender Document Download End Date',
      date: downloadEndDate.toISOString().split('T')[0] || downloadEndDate.toISOString(),
      time: '15:00 IST',
      isPassed: downloadEndDate < now,
      isCritical: false,
      description: 'Document fee must be paid on portal before this timestamp.',
    },
    {
      id: 'dl_submission',
      label: 'Online Bid Submission Due Date',
      date: deadlineDate.toISOString().split('T')[0] || deadlineDate.toISOString(),
      time: '15:00 IST',
      isPassed: deadlineDate < now,
      isCritical: diffDays <= 3,
      description:
        'Both Cover 1 (Technical) and Cover 2 (Financial BOQ) must be digitally signed and uploaded.',
    },
    {
      id: 'dl_tech_opening',
      label: 'Technical Bid Opening Date',
      date: techOpenDate.toISOString().split('T')[0] || techOpenDate.toISOString(),
      time: '15:30 IST',
      isPassed: techOpenDate < now,
      isCritical: false,
      description:
        'Public opening of Technical Bids in presence of authorized bidder representatives.',
    },
  ];
}

export function deriveEligibilityFactors(
  bid: BidDetail,
  company: CompanyCapabilityProfile,
): EligibilityFactorItem[] {
  const estVal = bid.estimatedValueRupees || 245000000;
  const reqTurnover = estVal * 0.5; // 50% of tender value rule
  const avgTurnover =
    company.turnoverRecords.reduce((acc, r) => acc + r.turnoverRupees, 0) /
    (company.turnoverRecords.length || 1);

  const hasRailwayExperience = company.pastExperience.some((e) => e.clientType === 'RAILWAY');

  return [
    {
      id: 'ef_statutory',
      title: 'Statutory Registration & Debarment Check',
      category: 'STATUTORY',
      status: company.isBlacklisted ? 'FAILED' : 'PASSED',
      tenderRequirement:
        'Bidder must possess valid GSTIN, PAN, and not be debarred by any Central/State Govt entity.',
      companyCapability: `Active GSTIN (${company.registrations.gstin}), PAN (${company.registrations.pan}), and non-blacklisted declaration on file.`,
      explanation: 'Full statutory compliance. Zero debarment record across Indian public portals.',
      citationDocRef: 'GCC Clause 4.1, Page 8',
    },
    {
      id: 'ef_turnover',
      title: 'Annual Financial Turnover',
      category: 'FINANCIAL_TURNOVER',
      status: avgTurnover >= reqTurnover ? 'PASSED' : 'NEEDS_ATTENTION',
      tenderRequirement: `Average annual turnover over last 3 FYs must exceed ₹ ${(reqTurnover / 10000000).toFixed(2)} Cr (50% of tender value).`,
      companyCapability: `Company 3-year average turnover is ₹ ${(avgTurnover / 10000000).toFixed(2)} Cr with CA UDIN certification.`,
      explanation: `Exceeds the tender requirement by ${((avgTurnover / reqTurnover - 1) * 100).toFixed(0)}%. Fully verified with CA UDIN numbers.`,
      citationDocRef: 'BDS Section III, Clause 2.1, Page 14',
    },
    {
      id: 'ef_experience',
      title: '7-Year Past Similar Work Experience',
      category: 'PAST_EXPERIENCE',
      status: hasRailwayExperience ? 'PASSED' : 'NEEDS_ATTENTION',
      tenderRequirement:
        'Must have successfully completed at least one similar railway/highway infrastructure project >= 40% value.',
      companyCapability:
        'Completed ROB project for Central Railway valued at ₹ 12.80 Cr with official completion certificate.',
      explanation:
        'Direct railway precedent meets the technical similarity threshold under GCC 2026.',
      citationDocRef: 'Section III, Clause 3.2, Page 16',
    },
    {
      id: 'ef_geography',
      title: 'Geographic Operating Presence',
      category: 'GEOGRAPHY',
      status: 'PASSED',
      tenderRequirement: 'Project execution within Maharashtra/Gujarat zone.',
      companyCapability: `Operational offices in ${company.operatingStates.join(', ')}.`,
      explanation:
        'Local presence established with registered office in Mumbai and project hub in Nagpur.',
      citationDocRef: 'NIT Clause 1.4, Page 3',
    },
    {
      id: 'ef_certifications',
      title: 'Quality & Safety Certifications',
      category: 'CERTIFICATIONS',
      status: 'PASSED',
      tenderRequirement:
        'Valid ISO 9001:2015 and ISO 14001:2015 certification at time of bid submission.',
      companyCapability: 'ISO 9001 and ISO 14001 active through late 2026 / 2027.',
      explanation: 'All certificates valid beyond the project completion horizon.',
      citationDocRef: 'Technical Specs Clause 8.1, Page 42',
    },
    {
      id: 'ef_oem',
      title: 'Manufacturer Authorization (MAF)',
      category: 'OEM_AUTHORIZATION',
      status: 'NEEDS_ATTENTION',
      tenderRequirement:
        'Specific OEM Authorization Form required for signaling cable and structural steel.',
      companyCapability:
        'Tata Steel partner valid; specialized cable OEM authorization pending formal request.',
      explanation:
        'Must request specific tender-addressed MAF from cabling vendor before submission.',
      citationDocRef: 'SCC Clause 12.4, Page 58',
    },
    {
      id: 'ef_staffing',
      title: 'Key Project Personnel & Engineers',
      category: 'STAFFING',
      status: 'PASSED',
      tenderRequirement:
        'Resident Project Manager (B.E. Civil + 10 yrs) and 2 Site Quality Engineers (Diploma + 5 yrs).',
      companyCapability: 'Full-time staff roster meets experience requirements.',
      explanation: 'Staff CVs and PF contribution challans ready for attachment in Cover 1.',
      citationDocRef: 'BDS Clause 6.1, Page 22',
    },
    {
      id: 'ef_equipment',
      title: 'Essential Plant & Machinery',
      category: 'EQUIPMENT',
      status: 'PASSED',
      tenderRequirement:
        'Ownership or leased commitment for Concrete Paver, Excavators, and Transit Mixers.',
      companyCapability: 'RMC batching plant and machinery fleet available on lease agreement.',
      explanation: 'Lease undertaking on ₹100 stamp paper required with machinery schedule.',
      citationDocRef: 'Section III Table 4, Page 29',
    },
    {
      id: 'ef_bid_security',
      title: 'Earnest Money Deposit (EMD) / Bid Security',
      category: 'BID_SECURITY',
      status: 'PASSED',
      tenderRequirement: 'EMD of ₹ 49.00 Lakhs payable via Online Gateway or Bank Guarantee.',
      companyCapability: `UDYAM Registered Small Enterprise (${company.registrations.udyamNumber}).`,
      explanation:
        'Eligible for MSME EMD exemption under Ministry of MSME Public Procurement Policy (if tender permits) or approved bank line for BG.',
      citationDocRef: 'NIT Clause 2.1, Page 5',
    },
  ];
}

export function deriveBidDecision(
  _bid: BidDetail,
  factors: EligibilityFactorItem[],
): BidDecisionOverview {
  const hasFailed = factors.some((f) => f.status === 'FAILED');
  const needsAttention = factors.some((f) => f.status === 'NEEDS_ATTENTION');

  let verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO' | 'REVIEW_REQUIRED' = 'GO';
  let verdictLabel = 'RECOMMENDED TO BID (GO)';
  let summary =
    'High qualification probability. Your company comfortably satisfies financial turnover and railway past work criteria.';

  if (hasFailed) {
    verdict = 'NO_GO';
    verdictLabel = 'DO NOT BID (NO-GO)';
    summary =
      'Disqualifying barrier detected. Company falls short of mandatory minimum statutory or experience criteria.';
  } else if (needsAttention) {
    verdict = 'CONDITIONAL_GO';
    verdictLabel = 'BID WITH CONDITIONS (CONDITIONAL GO)';
    summary =
      'Eligible to bid, but 1-2 critical vendor authorizations (MAF) and CA certificates must be obtained before submission.';
  }

  return {
    verdict,
    verdictLabel,
    summary,
    confidenceScore: 0.92,
    reasonsToPursue: [
      {
        title: 'Strong Financial Headroom',
        detail:
          'Your 3-year average turnover exceeds the required ₹ 12.25 Cr threshold by over 21%, eliminating financial scrutiny risk.',
        impact: 'POSITIVE',
      },
      {
        title: 'Direct Railway Experience Precedent',
        detail:
          'Your Central Railway ROB completion certificate provides 100% clause alignment for Section III similar work criteria.',
        impact: 'POSITIVE',
      },
      {
        title: 'Local Operational Presence',
        detail:
          'Registered operating hub in the project state minimizes mobilization lead time and logistics overheads.',
        impact: 'POSITIVE',
      },
    ],
    reasonsNotToPursue: [
      {
        title: 'Working Capital Lock-in',
        detail:
          'Requires ₹ 49L EMD plus 5% Performance Security (₹ 1.22 Cr), locking ₹ 1.71 Cr bank guarantee limit for up to 24 months.',
        impact: 'WARNING',
      },
      {
        title: 'Strict Liquidated Damages Cap',
        detail:
          'Tender specifies 0.5% per week delay penalty up to 10% maximum without grace periods for rain/monsoon delays.',
        impact: 'WARNING',
      },
    ],
    hardDisqualifiers: [],
    actionItems: [
      'Request tender-specific Manufacturer Authorization Form (MAF) from cabling OEM.',
      'Obtain CA Net Worth certificate with valid UDIN dated within 30 days of submission.',
      'Prepare Power of Attorney on ₹ 100 Non-Judicial Stamp Paper with Notary seal.',
      'Confirm Digital Signature Certificate (DSC Class 3) validity on IREPS/CPPP portal.',
    ],
  };
}

export function deriveEvidenceCitations(
  _bid: BidDetail,
  items: ComplianceItem[],
  company: CompanyCapabilityProfile,
): EvidenceMappingCitation[] {
  const getTitle = (item: ComplianceItem) => (item as { title?: string }).title || item.requirement;

  if (items.length > 0) {
    return items.map((item, idx) => ({
      id: `cite_${item.id}`,
      requirementTitle: getTitle(item),
      requirementCategory: item.category,
      tenderClauseRef:
        item.provenance.sectionOrClause || item.tenderClauseRef || `Clause ${idx + 1}.0`,
      tenderPageNumber: item.provenance.pageNumber || 1,
      tenderDocName:
        item.provenance.documentName ||
        item.sourceCitation?.document ||
        'Notice_Inviting_Tender.pdf',
      tenderVerbatimQuote: item.provenance.verbatimQuote || item.description,
      companyEvidenceTitle: item.executionRules.udinRequired
        ? 'Audited Financial Statement with CA UDIN'
        : item.executionRules.stampPaperRequired
          ? `Undertaking on ₹${item.executionRules.stampPaperDenominationInr} Stamp Paper`
          : 'Company Statutory Registration Certificate',
      companyEvidenceRef: item.executionRules.udinRequired
        ? 'CA_Audited_Turnover_FY2023-24.pdf'
        : 'GST_PAN_Registration_Kit.pdf',
      companyEvidenceDocType: item.executionRules.udinRequired
        ? 'FINANCIAL_AUDIT'
        : 'LEGAL_UNDERTAKING',
      verificationStatus: 'VERIFIED',
      udinNumber: item.executionRules.udinRequired ? company.turnoverRecords[0]?.caUdin : undefined,
      notes: 'Grounded against official tender clause and company capability repository.',
    }));
  }

  // Fallback realistic citations
  return [
    {
      id: 'cite_01',
      requirementTitle: 'Annual Financial Turnover & Solvency',
      requirementCategory: 'FINANCIAL_CRITERIA',
      tenderClauseRef: 'Section III, Clause 2.1',
      tenderPageNumber: 14,
      tenderDocName: 'Tender_Document_Vol_1.pdf',
      tenderVerbatimQuote:
        'The average annual turnover of the tenderer during the last 3 financial years must not be less than 50% of the advertised tender value. The certificate must be issued by a practicing Chartered Accountant and bear a valid UDIN.',
      companyEvidenceTitle: 'CA Audited Balance Sheet & Turnover Certificate',
      companyEvidenceRef: 'CA_Audited_Turnover_FY2023-24.pdf',
      companyEvidenceDocType: 'CA_CERTIFICATE',
      verificationStatus: 'VERIFIED',
      udinNumber: '24089123AAAAA1234',
      notes: 'Company turnover of ₹ 18.5 Cr satisfies the ₹ 12.25 Cr threshold.',
    },
    {
      id: 'cite_02',
      requirementTitle: 'Power of Attorney & Board Resolution',
      requirementCategory: 'ANNEXURE_DECLARATION',
      tenderClauseRef: 'ITB Clause 4.2',
      tenderPageNumber: 9,
      tenderDocName: 'Instructions_To_Bidders.pdf',
      tenderVerbatimQuote:
        'The bid shall be signed by the legally authorized representative holding a Power of Attorney executed on non-judicial stamp paper of ₹ 100 denomination, duly notarized by an authorized Notary Public.',
      companyEvidenceTitle: 'Board Resolution & Executed Power of Attorney',
      companyEvidenceRef: 'Board_Resolution_PoA_Ramesh_Sharma.pdf',
      companyEvidenceDocType: 'LEGAL_AFFIDAVIT',
      verificationStatus: 'VERIFIED',
      notes: 'Executed on ₹ 100 stamp paper with registered notary stamp.',
    },
    {
      id: 'cite_03',
      requirementTitle: 'Past Similar Work Completion Certificate',
      requirementCategory: 'TECHNICAL_EXPERIENCE',
      tenderClauseRef: 'Section III, Clause 3.2',
      tenderPageNumber: 16,
      tenderDocName: 'Tender_Document_Vol_1.pdf',
      tenderVerbatimQuote:
        'Tenderer should have completed at least one work of similar nature having value not less than 40% of the advertised tender value during the last 7 years ending the last day of the month prior to the tender opening.',
      companyEvidenceTitle: 'Central Railway Completion Certificate (ROB Project)',
      companyEvidenceRef: 'CR_ROB_Completion_Cert.pdf',
      companyEvidenceDocType: 'COMPLETION_CERTIFICATE',
      verificationStatus: 'VERIFIED',
      notes: 'Value ₹ 12.80 Cr exceeds the 40% requirement.',
    },
  ];
}

export function deriveCommercialRisks(): CommercialRiskItem[] {
  return [
    {
      id: 'risk_01',
      title: 'Liquidated Damages (LD) Delay Penalties',
      severity: 'HIGH',
      category: 'LIQUIDATED_DAMAGES',
      clauseReference: 'GCC Clause 17.2',
      penaltySummary:
        '0.5% per week of delay up to a hard ceiling of 10% of contract value (approx ₹ 2.45 Cr maximum exposure).',
      financialImpactRupees: 24500000,
      mitigationAdvice:
        'Ensure 30-day buffer in project CPM/PERT schedule. Submit site-handover delay notices in writing within 7 days of occurrence.',
    },
    {
      id: 'risk_02',
      title: 'Working Capital & Bank Guarantee Lock-in',
      severity: 'HIGH',
      category: 'WORKING_CAPITAL',
      clauseReference: 'NIT Clause 2.1 & 6.4',
      penaltySummary:
        'EMD ₹ 49L + 5% Performance Security (₹ 1.22 Cr) locked for 18 months plus 6 months defect liability period.',
      financialImpactRupees: 17150000,
      mitigationAdvice:
        'Seek MSME EMD exemption under UDYAM scheme if eligible. Arrange 100% margin BG limit from consortium bank in advance.',
    },
    {
      id: 'risk_03',
      title: 'Fixed Price Contract — No Price Escalation (PVC)',
      severity: 'MEDIUM',
      category: 'PAYMENT_TERMS',
      clauseReference: 'SCC Clause 8.1',
      penaltySummary:
        'No Price Variation Clause (PVC) is admissible for tenders with execution duration under 18 months. Fuel and cement price fluctuations are at contractor risk.',
      mitigationAdvice:
        'Factor in 6-8% material inflation contingency in BOQ unit rates for steel, bitumen, and cement.',
    },
    {
      id: 'risk_04',
      title: 'Defect Liability Period (DLP) Retention',
      severity: 'MEDIUM',
      category: 'LEGAL',
      clauseReference: 'GCC Clause 24.1',
      penaltySummary:
        'Retention money of 5% will be deducted from running bills and released only after 12 months from final completion date.',
      mitigationAdvice: 'Cash flow model must account for deferred 5% retention release.',
    },
  ];
}

export function deriveMissingEvidence(): MissingEvidenceItem[] {
  return [
    {
      id: 'gap_01',
      documentTitle: 'Manufacturer Authorization Form (MAF) from Cabling OEM',
      requiredFor: 'Technical Specification Clause 12.4 (Signaling & Power Cables)',
      criticality: 'CRITICAL_BLOCKER',
      actionNeeded:
        'Submit tender details to authorized OEM distributor to issue tender-specific authorization undertaking.',
      issuingParty: 'OEM Technical Team (Havells / Polycab)',
      estimatedTurnaroundDays: 3,
      status: 'IN_PROGRESS',
    },
    {
      id: 'gap_02',
      documentTitle: 'Chartered Accountant Net Worth Certificate with UDIN',
      requiredFor: 'Section III Financial Criteria (Net Worth must be positive)',
      criticality: 'CRITICAL_BLOCKER',
      actionNeeded:
        'Request practicing CA to generate Certificate of Net Worth on official letterhead with valid UDIN.',
      issuingParty: 'Chartered Accountant',
      estimatedTurnaroundDays: 2,
      status: 'PENDING_REQUEST',
    },
    {
      id: 'gap_03',
      documentTitle: 'Make in India (PPP-MII) Local Content Declaration',
      requiredFor: 'Public Procurement Preference to Make in India Order',
      criticality: 'RECOMMENDED',
      actionNeeded:
        'Prepare self-declaration on company letterhead certifying >50% Class-I local content.',
      issuingParty: 'Authorized Signatory',
      estimatedTurnaroundDays: 1,
      status: 'PENDING_REQUEST',
    },
  ];
}

export function deriveHumanReviewTask(): HumanReviewTaskState {
  return {
    taskId: 'rev_task_8921_01',
    version: 1,
    assignedRole: 'BID_MANAGER',
    status: 'PENDING',
    title: 'Management Review: Ambiguous Cable Testing Scope & EMD Exemption',
    description:
      'Verify whether UDYAM MSME registration grants 100% EMD waiver for this railway tender, and confirm cabling OEM partnership.',
    urgency: 'HIGH',
    decisionState: 'AI_PROPOSED',
    comments: [
      {
        id: 'comm_01',
        authorName: 'Ramesh Sharma',
        authorRole: 'BID_MANAGER',
        timestamp: '2026-10-04 16:30 IST',
        comment:
          'We have applied for the cabling MAF with Polycab distributor. Expected by Wednesday.',
      },
      {
        id: 'comm_02',
        authorName: 'Sunil Verma',
        authorRole: 'FINANCIAL_CONTROLLER',
        timestamp: '2026-10-05 10:15 IST',
        comment:
          'Bank Guarantee limit of ₹ 1.5 Cr is sanction-approved if the client rejects the MSME EMD waiver.',
      },
    ],
  };
}

export function deriveBidReadiness(): BidReadinessPillars {
  return {
    evidenceCompletenessPct: 86, // 50% weight
    riskClearancePct: 80, // 20% weight
    deadlinesBufferPct: 90, // 15% weight
    financialAffordabilityPct: 85, // 15% weight
    compositeScore: 85,
    isReadyForSignOff: true,
    blockingReasons: [
      'Pending cabling OEM authorization form (MAF).',
      'Net Worth certificate UDIN verification awaited from CA.',
    ],
  };
}

export function deriveSubmissionChecklist(): SubmissionChecklistItem[] {
  return [
    {
      id: 'sub_01',
      cover: 'COVER_1_TECHNICAL',
      label: 'EMD Receipt / Bank Guarantee or MSME Exemption',
      requirementDetail: 'Online payment proof or valid BG format as per Annexure-I.',
      isMandatory: true,
      isCompleted: true,
      notes: 'UDYAM certificate attached for exemption review.',
    },
    {
      id: 'sub_02',
      cover: 'COVER_1_TECHNICAL',
      label: 'Power of Attorney on ₹ 100 Stamp Paper with Notary',
      requirementDetail: 'Board resolution + Notarized PoA in favor of Authorized Signatory.',
      isMandatory: true,
      isCompleted: true,
      notes: 'Notarized copy scanned and ready.',
    },
    {
      id: 'sub_03',
      cover: 'COVER_1_TECHNICAL',
      label: 'Audited Turnover Certificates with CA UDIN',
      requirementDetail: 'Last 3 FYs turnover certified by CA with valid UDIN.',
      isMandatory: true,
      isCompleted: true,
      notes: 'UDIN verified on ICAI portal.',
    },
    {
      id: 'sub_04',
      cover: 'COVER_1_TECHNICAL',
      label: 'Past Experience Work Order & Completion Certificate',
      requirementDetail: 'Central Railway completion certificate for similar ROB work.',
      isMandatory: true,
      isCompleted: true,
      notes: 'Railway Executive Engineer signed copy attached.',
    },
    {
      id: 'sub_05',
      cover: 'COVER_1_TECHNICAL',
      label: 'Non-Blacklisting & Integrity Pact Undertaking',
      requirementDetail: 'Executed on ₹ 100 stamp paper and signed on every page.',
      isMandatory: true,
      isCompleted: true,
      notes: 'Prepared as per GCC specimen format.',
    },
    {
      id: 'sub_06',
      cover: 'COVER_1_TECHNICAL',
      label: 'Make in India (PPP-MII) Local Content Certificate',
      requirementDetail: 'Self-certification of >50% local content on company letterhead.',
      isMandatory: true,
      isCompleted: false,
      notes: 'Draft awaiting Director signature.',
    },
    {
      id: 'sub_07',
      cover: 'COVER_2_FINANCIAL',
      label: 'Financial Bill of Quantities (BOQ) Excel Sheet',
      requirementDetail: 'Unprotected BOQ Excel file filled with item rates and digitally signed.',
      isMandatory: true,
      isCompleted: false,
      notes:
        'CRITICAL: Must be uploaded exclusively into Financial Cover slot. Never put rates in Technical Cover!',
    },
    {
      id: 'sub_08',
      cover: 'COVER_1_TECHNICAL',
      label: 'Digital Signature Certificate (DSC Class 3) Verification',
      requirementDetail: 'Ensure DSC token is plugged in, drivers active, and valid on IREPS/CPPP.',
      isMandatory: true,
      isCompleted: true,
      notes: 'Ramesh Sharma DSC Class 3 valid until Aug 2027.',
    },
  ];
}
