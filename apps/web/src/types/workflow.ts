/**
 * TenderPulse AI — Workflow Domain Types
 *
 * Types for the 13-stage Indian MSME contractor bidding workflow:
 * 1. Company Profile
 * 2. Tender Intake
 * 3. Tender Overview
 * 4. Key Deadlines
 * 5. Eligibility Summary (9-Factor)
 * 6. Bid/No-Bid Recommendation
 * 7. Requirement Matrix
 * 8. Evidence Mapping
 * 9. Commercial Risks
 * 10. Missing Evidence (Acquisition Checklist)
 * 11. Human Review (HITL)
 * 12. Bid Readiness Score
 * 13. Submission Preparation (Two-Cover Packager)
 */

export type WorkflowStageId =
  | 'company-profile'
  | 'tender-intake'
  | 'tender-overview'
  | 'key-deadlines'
  | 'eligibility-summary'
  | 'bid-decision'
  | 'requirement-matrix'
  | 'evidence-mapping'
  | 'commercial-risks'
  | 'missing-evidence'
  | 'human-review'
  | 'bid-readiness'
  | 'submission-prep';

export type WorkflowMilestoneId =
  'basics' | 'eligibility' | 'compliance' | 'risks-review' | 'submission';

export interface WorkflowStageMeta {
  id: WorkflowStageId;
  milestone: WorkflowMilestoneId;
  stepNumber: number;
  label: string;
  shortLabel: string;
  description: string;
  icon: string;
}

// -------------------------------------------------------------
// 1. Company Profile (Persistent Capability)
// -------------------------------------------------------------
export interface FinancialTurnoverRecord {
  financialYear: string; // e.g. "2023-24"
  turnoverRupees: number;
  audited: boolean;
  caUdin?: string; // Chartered Accountant Unique Document Identification Number
  evidenceDocName?: string;
}

export interface PastExperienceRecord {
  id: string;
  projectTitle: string;
  clientName: string;
  clientType: 'CENTRAL_GOVT' | 'STATE_GOVT' | 'RAILWAY' | 'PSU' | 'PRIVATE';
  contractValueRupees: number;
  completionDate: string;
  completionCertificateDocName?: string;
  scopeSummary: string;
}

export interface CertificationRecord {
  id: string;
  name: string; // e.g. "ISO 9001:2015", "CMMI Level 3"
  issuingBody: string;
  certificateNumber: string;
  validUntil: string;
  evidenceDocName?: string;
}

export interface OemAuthorizationRecord {
  id: string;
  oemName: string; // e.g. "Siemens", "Schneider Electric", "Cisco"
  productCategory: string;
  validUntil: string;
  mafDocName?: string;
}

export interface CompanyCapabilityProfile {
  companyId: string;
  companyName: string;
  profileVersion: string;
  businessType: 'PRIVATE_LIMITED' | 'PARTNERSHIP' | 'PROPRIETORSHIP' | 'PUBLIC_LIMITED';
  registrations: {
    gstin: string;
    pan: string;
    udyamNumber: string; // Indian MSME UDYAM registration
    msmeCategory: 'MICRO' | 'SMALL' | 'MEDIUM';
    epfoNumber?: string;
    esicNumber?: string;
  };
  isBlacklisted: boolean;
  turnoverRecords: FinancialTurnoverRecord[];
  pastExperience: PastExperienceRecord[];
  certifications: CertificationRecord[];
  oemAuthorizations: OemAuthorizationRecord[];
  operatingStates: string[];
  authorizedSignatories: Array<{
    name: string;
    designation: string;
    pan: string;
    dscTokenValidUntil: string;
  }>;
}

// -------------------------------------------------------------
// 4. Key Deadlines
// -------------------------------------------------------------
export interface TenderDeadline {
  id: string;
  label: string;
  date: string;
  time?: string;
  isPassed: boolean;
  isCritical: boolean; // e.g. within 72 hours
  description: string;
}

// -------------------------------------------------------------
// 5. Eligibility Summary (9-Factor Breakdown)
// -------------------------------------------------------------
export type EligibilityFactorStatus = 'PASSED' | 'NEEDS_ATTENTION' | 'FAILED' | 'NOT_APPLICABLE';

export interface EligibilityFactorItem {
  id: string;
  title: string;
  category:
    | 'STATUTORY'
    | 'FINANCIAL_TURNOVER'
    | 'PAST_EXPERIENCE'
    | 'GEOGRAPHY'
    | 'CERTIFICATIONS'
    | 'OEM_AUTHORIZATION'
    | 'STAFFING'
    | 'EQUIPMENT'
    | 'BID_SECURITY';
  status: EligibilityFactorStatus;
  tenderRequirement: string;
  companyCapability: string;
  explanation: string;
  citationDocRef?: string;
}

// -------------------------------------------------------------
// 6. Bid/No-Bid Recommendation
// -------------------------------------------------------------
export type BidVerdict = 'GO' | 'CONDITIONAL_GO' | 'NO_GO' | 'REVIEW_REQUIRED';

export interface DecisionReasonItem {
  title: string;
  detail: string;
  impact: 'POSITIVE' | 'NEGATIVE' | 'WARNING';
}

export interface BidDecisionOverview {
  verdict: BidVerdict;
  verdictLabel: string;
  summary: string;
  confidenceScore: number;
  reasonsToPursue: DecisionReasonItem[];
  reasonsNotToPursue: DecisionReasonItem[];
  hardDisqualifiers: Array<{
    requirement: string;
    reason: string;
    clause: string;
  }>;
  actionItems: string[];
}

// -------------------------------------------------------------
// 8. Evidence Mapping & Citations
// -------------------------------------------------------------
export interface EvidenceMappingCitation {
  id: string;
  requirementTitle: string;
  requirementCategory: string;
  tenderClauseRef: string;
  tenderPageNumber: number;
  tenderDocName: string;
  tenderVerbatimQuote: string;
  companyEvidenceTitle: string;
  companyEvidenceRef: string;
  companyEvidenceDocType: string;
  verificationStatus: 'VERIFIED' | 'SELF_ATTESTED' | 'EXPIRED' | 'MISSING';
  udinNumber?: string;
  notes: string;
}

// -------------------------------------------------------------
// 9. Commercial & Operational Risks
// -------------------------------------------------------------
export interface CommercialRiskItem {
  id: string;
  title: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  category: 'LIQUIDATED_DAMAGES' | 'WORKING_CAPITAL' | 'TIMELINE' | 'PAYMENT_TERMS' | 'LEGAL';
  clauseReference: string;
  penaltySummary: string;
  financialImpactRupees?: number;
  mitigationAdvice: string;
}

// -------------------------------------------------------------
// 10. Missing Evidence (Acquisition Checklist)
// -------------------------------------------------------------
export interface MissingEvidenceItem {
  id: string;
  documentTitle: string;
  requiredFor: string;
  criticality: 'CRITICAL_BLOCKER' | 'RECOMMENDED' | 'OPTIONAL';
  actionNeeded: string;
  issuingParty: string; // e.g. "Chartered Accountant", "OEM (Siemens)", "State Revenue Dept"
  estimatedTurnaroundDays: number;
  status: 'PENDING_REQUEST' | 'IN_PROGRESS' | 'ACQUIRED';
}

// -------------------------------------------------------------
// 11. Human Review (HITL)
// -------------------------------------------------------------
export type ReviewerRoleType =
  'BID_MANAGER' | 'LEGAL_COUNSEL' | 'FINANCIAL_CONTROLLER' | 'TECHNICAL_LEAD' | 'BID_DIRECTOR';

export type ReviewTaskStatusType = 'PENDING' | 'IN_REVIEW' | 'ESCALATED' | 'COMPLETED';

export interface ReviewCommentItem {
  id: string;
  authorName: string;
  authorRole: ReviewerRoleType;
  timestamp: string;
  comment: string;
}

export interface HumanReviewTaskState {
  taskId: string;
  version: number; // Optimistic Concurrency Control (OCC)
  assignedRole: ReviewerRoleType;
  status: ReviewTaskStatusType;
  title: string;
  description: string;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decisionState: 'AI_PROPOSED' | 'HUMAN_CONFIRMED' | 'HUMAN_OVERRIDDEN';
  confirmedBy?: string;
  confirmedAt?: string;
  overrideJustification?: string;
  comments: ReviewCommentItem[];
}

// -------------------------------------------------------------
// 12. Bid Readiness Score
// -------------------------------------------------------------
export interface BidReadinessPillars {
  evidenceCompletenessPct: number; // Weight 50%
  riskClearancePct: number; // Weight 20%
  deadlinesBufferPct: number; // Weight 15%
  financialAffordabilityPct: number; // Weight 15%
  compositeScore: number; // 0 to 100
  isReadyForSignOff: boolean;
  blockingReasons: string[];
}

// -------------------------------------------------------------
// 13. Submission Preparation Checklist
// -------------------------------------------------------------
export interface SubmissionChecklistItem {
  id: string;
  cover: 'COVER_1_TECHNICAL' | 'COVER_2_FINANCIAL';
  label: string;
  requirementDetail: string;
  isMandatory: boolean;
  isCompleted: boolean;
  notes?: string;
}
