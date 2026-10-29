/**
 * TenderPulse AI — Company Capability Profile Domain Model & Helpers
 *
 * Core differentiator: Persistent, reusable capability dossier evaluated
 * deterministically against incoming tender requirements.
 *
 * "Maintain your company information once and reuse it across tenders."
 */

export type CapabilityStatus =
  | 'VERIFIED'
  | 'SOURCE_VERIFIED'
  | 'UNVERIFIED'
  | 'IMPORTED'
  | 'EXTRACTED'
  | 'EXPIRING_SOON'
  | 'EXPIRED'
  | 'MISSING'
  | 'NEEDS_REVIEW'
  | 'REJECTED';

export type CapabilitySectionId =
  | 'overview'
  | 'registrations'
  | 'certifications'
  | 'financials'
  | 'experience'
  | 'projects'
  | 'oem'
  | 'employees'
  | 'equipment'
  | 'geography'
  | 'evidence';

export interface BaseCapabilityItem {
  id: string;
  title: string;
  status: CapabilityStatus;
  evidenceDocName?: string;
  evidenceDocSize?: string;
  evidenceDocId?: string;
  verificationNotes?: string;
  lastVerifiedAt?: string;
}

export interface RegistrationItem extends BaseCapabilityItem {
  regType: 'GSTIN' | 'PAN' | 'UDYAM' | 'EPFO' | 'ESIC' | 'GEM' | 'CPWD_LICENSE' | 'CPPP';
  regNumber: string;
  issuingAuthority: string;
  validUntil?: string | null;
  stateOrJurisdiction?: string;
}

export interface CertificationItem extends BaseCapabilityItem {
  standard: string; // e.g. "ISO 9001:2015", "CMMI Dev Level 3"
  issuingBody: string; // e.g. "Bureau Veritas", "TUV Rheinland"
  certificateNumber: string;
  validFrom: string;
  validUntil: string;
  scopeSummary: string;
}

export interface FinancialTurnoverItem extends BaseCapabilityItem {
  financialYear: string; // e.g. "FY 2023-24"
  turnoverInrCrores: number;
  netWorthInrCrores: number;
  profitAfterTaxCrores?: number;
  caFirmName: string;
  caMembershipNo: string;
  caUdin: string;
  isUdinValidated: boolean;
  audited: boolean;
}

export interface SolvencyItem extends BaseCapabilityItem {
  bankName: string;
  solvencyLimitInrCrores: number;
  sanctionDate: string;
  validUntil: string;
  accountNumberMasked: string;
}

export interface ExperienceItem extends BaseCapabilityItem {
  projectTitle: string;
  clientName: string;
  clientType: 'CENTRAL_GOVT' | 'STATE_GOVT' | 'RAILWAY' | 'PSU' | 'DEFENCE' | 'PRIVATE';
  contractValueInrCrores: number;
  completionDate: string;
  locationState: string;
  scopeHighlights: string[];
  workTypeTags: string[];
}

export interface ProjectContractItem extends BaseCapabilityItem {
  projectName: string;
  clientName: string;
  role: 'PRIME_CONTRACTOR' | 'JOINT_VENTURE_PARTNER' | 'SUBCONTRACTOR';
  contractValueInrCrores: number;
  startDate: string;
  endDate: string;
  statusText: 'COMPLETED' | 'IN_PROGRESS';
  keyDeliverables: string;
}

export interface OemAuthorizationItem extends BaseCapabilityItem {
  oemName: string; // e.g. "Siemens Ltd.", "Tata Steel", "Schneider Electric"
  partnerTier: string; // e.g. "Tier-1 Value Added Partner", "Gold OEM Partner"
  productCategories: string[];
  authorizedTerritory: string; // e.g. "Pan-India", "Western Region"
  validFrom: string;
  validUntil: string;
  mafDocName: string;
}

export interface EmployeeItem extends BaseCapabilityItem {
  name: string;
  designation: string;
  role:
    'PROJECT_MANAGER' | 'LEAD_ENGINEER' | 'SAFETY_OFFICER' | 'QUALITY_AUDITOR' | 'COMMERCIAL_LEAD';
  qualification: string; // e.g. "B.Tech (Civil) + PMP", "M.Tech (Structures)"
  experienceYears: number;
  epfoUan?: string;
  isKeyPersonnel: boolean;
}

export interface EquipmentItem extends BaseCapabilityItem {
  name: string;
  modelAndMake: string;
  equipmentType: string;
  quantity: number;
  ownership: 'OWNED' | 'LEASED';
  manufactureYear: number;
  capacityOrRating: string;
  calibrationValidUntil?: string;
}

export interface GeographicCoverageItem extends BaseCapabilityItem {
  facilityType:
    'HEADQUARTERS' | 'REGIONAL_OFFICE' | 'BRANCH_OFFICE' | 'WAREHOUSE' | 'SERVICE_CENTER';
  state: string;
  city: string;
  address: string;
  slaResponseHours: number;
  serviceStaffCount: number;
}

export interface EvidenceVaultItem {
  id: string;
  fileName: string;
  fileSizeBytes: number;
  docType: string;
  uploadedAt: string;
  expiryDate?: string | null;
  validTo?: string | null;
  sha256Hash: string;
  linkedCapabilitiesCount: number;
  verificationStatus: CapabilityStatus;
  issuer?: string | null;
  referenceNumber?: string | null;
  validFrom?: string | null;
  extractedAttributes?: Record<string, unknown> | null;
}

export interface FullCompanyProfile {
  companyId: string;
  companyName: string;
  legalEntityName: string;
  cinNumber: string;
  incorporationDate: string;
  profileVersion: string;
  msmeCategory: 'MICRO' | 'SMALL' | 'MEDIUM' | 'LARGE ENTERPRISE';
  msmeType: 'MANUFACTURING' | 'SERVICES' | 'CONSTRUCTION_INFRA';
  isBlacklisted: boolean;
  creditRating?: {
    agency: string;
    rating: string;
    validUntil?: string | null;
  } | null;
  registrations: RegistrationItem[];
  certifications: CertificationItem[];
  turnoverRecords: FinancialTurnoverItem[];
  solvencyRecords: SolvencyItem[];
  pastExperience: ExperienceItem[];
  projects: ProjectContractItem[];
  oemAuthorizations: OemAuthorizationItem[];
  employees: EmployeeItem[];
  equipment: EquipmentItem[];
  geographicCoverage: GeographicCoverageItem[];
  evidenceVault: EvidenceVaultItem[];
}

// ------------------------------------------------------------------
// Health & Expiry Derivations
// ------------------------------------------------------------------

export interface ProfileHealthSummary {
  healthScorePct: number;
  totalItems: number;
  verifiedCount: number;
  expiringSoonCount: number;
  expiredCount: number;
  missingCount: number;
  needsReviewCount: number;
  isBidReady: boolean;
}

/** Compute aggregate capability health and verification status across all sections */
export function computeProfileHealth(profile: FullCompanyProfile): ProfileHealthSummary {
  const allStatuses: CapabilityStatus[] = [
    ...profile.registrations.map((r) => r.status),
    ...profile.certifications.map((c) => c.status),
    ...profile.turnoverRecords.map((t) => t.status),
    ...profile.solvencyRecords.map((s) => s.status),
    ...profile.pastExperience.map((e) => e.status),
    ...profile.projects.map((p) => p.status),
    ...profile.oemAuthorizations.map((o) => o.status),
    ...profile.employees.map((e) => e.status),
    ...profile.equipment.map((eq) => eq.status),
    ...profile.geographicCoverage.map((g) => g.status),
  ];

  const totalItems = allStatuses.length;
  if (totalItems === 0) {
    return {
      healthScorePct: 0,
      totalItems: 0,
      verifiedCount: 0,
      expiringSoonCount: 0,
      expiredCount: 0,
      missingCount: 0,
      needsReviewCount: 0,
      isBidReady: false,
    };
  }

  const verifiedCount = allStatuses.filter((s) => s === 'VERIFIED').length;
  const expiringSoonCount = allStatuses.filter((s) => s === 'EXPIRING_SOON').length;
  const expiredCount = allStatuses.filter((s) => s === 'EXPIRED').length;
  const missingCount = allStatuses.filter((s) => s === 'MISSING').length;
  const needsReviewCount = allStatuses.filter((s) => s === 'NEEDS_REVIEW').length;

  // Weight: Verified = 1.0, Expiring Soon = 0.7, Needs Review = 0.5, Missing/Expired = 0
  const weightedScore = verifiedCount * 1.0 + expiringSoonCount * 0.7 + needsReviewCount * 0.5;
  const healthScorePct = Math.round((weightedScore / totalItems) * 100);

  return {
    healthScorePct,
    totalItems,
    verifiedCount,
    expiringSoonCount,
    expiredCount,
    missingCount,
    needsReviewCount,
    isBidReady: healthScorePct >= 75 && expiredCount === 0 && !profile.isBlacklisted,
  };
}

/** Calculate days remaining until expiry */
export function getDaysUntilExpiry(dateString?: string | null): number | null {
  if (!dateString) return null;
  const target = new Date(dateString).getTime();
  const now = new Date().getTime();
  if (isNaN(target)) return null;
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

// ------------------------------------------------------------------
// Comprehensive Default Production Profile Data
// ------------------------------------------------------------------
