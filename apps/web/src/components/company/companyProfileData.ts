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
  role: 'PROJECT_MANAGER' | 'LEAD_ENGINEER' | 'SAFETY_OFFICER' | 'QUALITY_AUDITOR' | 'COMMERCIAL_LEAD';
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
  facilityType: 'HEADQUARTERS' | 'REGIONAL_OFFICE' | 'BRANCH_OFFICE' | 'WAREHOUSE' | 'SERVICE_CENTER';
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
  sha256Hash: string;
  linkedCapabilitiesCount: number;
  verificationStatus: CapabilityStatus;
}

export interface FullCompanyProfile {
  companyId: string;
  companyName: string;
  legalEntityName: string;
  cinNumber: string;
  incorporationDate: string;
  profileVersion: string;
  msmeCategory: 'MICRO' | 'SMALL' | 'MEDIUM';
  msmeType: 'MANUFACTURING' | 'SERVICES' | 'CONSTRUCTION_INFRA';
  isBlacklisted: boolean;
  creditRating: {
    agency: string;
    rating: string;
    validUntil: string;
  };
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
  const weightedScore =
    verifiedCount * 1.0 + expiringSoonCount * 0.7 + needsReviewCount * 0.5;
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

export const ENTERPRISE_COMPANY_PROFILE: FullCompanyProfile = {
  companyId: 'comp_apex_infra_001',
  companyName: 'Apex Infra Projects Private Limited',
  legalEntityName: 'Apex Infra Projects Pvt. Ltd.',
  cinNumber: 'U45200MH2012PTC231456',
  incorporationDate: '2012-05-18',
  profileVersion: 'v2.4 (Active Pinned)',
  msmeCategory: 'SMALL',
  msmeType: 'CONSTRUCTION_INFRA',
  isBlacklisted: false,
  creditRating: {
    agency: 'CRISIL Ratings',
    rating: 'CRISIL BBB+ (Stable Outlook)',
    validUntil: '2027-03-31',
  },
  registrations: [
    {
      id: 'reg-gstin',
      title: 'Goods & Services Tax (GSTIN) — Maharashtra',
      regType: 'GSTIN',
      regNumber: '27AABCU9603R1ZM',
      issuingAuthority: 'Goods & Services Tax Network (GSTN)',
      stateOrJurisdiction: 'Maharashtra (State Code 27)',
      status: 'VERIFIED',
      evidenceDocName: 'GST_Registration_Certificate_Form_REG06.pdf',
      evidenceDocSize: '1.2 MB',
      lastVerifiedAt: '2026-09-15',
    },
    {
      id: 'reg-pan',
      title: 'Permanent Account Number (PAN)',
      regType: 'PAN',
      regNumber: 'AABCU9603R',
      issuingAuthority: 'Income Tax Department of India',
      stateOrJurisdiction: 'Pan-India',
      status: 'VERIFIED',
      evidenceDocName: 'Company_PAN_Card_ApexInfra.pdf',
      evidenceDocSize: '840 KB',
      lastVerifiedAt: '2026-09-15',
    },
    {
      id: 'reg-udyam',
      title: 'MSME Udyam Registration',
      regType: 'UDYAM',
      regNumber: 'UDYAM-MH-26-0012345',
      issuingAuthority: 'Ministry of MSME, Govt of India',
      stateOrJurisdiction: 'Maharashtra',
      status: 'VERIFIED',
      evidenceDocName: 'Udyam_Registration_Certificate_2026.pdf',
      evidenceDocSize: '1.8 MB',
      lastVerifiedAt: '2026-09-20',
    },
    {
      id: 'reg-gem',
      title: 'Government e-Marketplace (GeM) Seller Registration',
      regType: 'GEM',
      regNumber: 'GEM/SELLER/MH/2021/88921',
      issuingAuthority: 'GeM SPV, Ministry of Commerce',
      stateOrJurisdiction: 'Pan-India Portal',
      status: 'VERIFIED',
      evidenceDocName: 'GeM_Seller_Verified_Profile.pdf',
      evidenceDocSize: '1.1 MB',
      lastVerifiedAt: '2026-08-10',
    },
    {
      id: 'reg-cpwd',
      title: 'CPWD Class-I (Civil & Bridges) Enlistment',
      regType: 'CPWD_LICENSE',
      regNumber: 'CPWD/WR/CLASS-I/2022/441',
      issuingAuthority: 'Central Public Works Department',
      validUntil: '2026-11-30',
      stateOrJurisdiction: 'Western Region & National',
      status: 'EXPIRING_SOON',
      evidenceDocName: 'CPWD_Class1_Contractor_Enlistment.pdf',
      evidenceDocSize: '2.3 MB',
      verificationNotes: 'Enlistment renewal application submitted to CPWD Delhi on Sep 28.',
      lastVerifiedAt: '2026-09-01',
    },
    {
      id: 'reg-epfo',
      title: 'Employees Provident Fund (EPFO) Code',
      regType: 'EPFO',
      regNumber: 'MH/BAN/0045612/000',
      issuingAuthority: 'EPFO India',
      stateOrJurisdiction: 'Bandra Regional Office',
      status: 'VERIFIED',
      evidenceDocName: 'EPFO_Registration_Letter.pdf',
      evidenceDocSize: '750 KB',
      lastVerifiedAt: '2026-07-14',
    },
  ],
  certifications: [
    {
      id: 'cert-iso-9001',
      title: 'Quality Management System (ISO 9001:2015)',
      standard: 'ISO 9001:2015',
      issuingBody: 'Bureau Veritas Quality International',
      certificateNumber: 'BVQI-IND-9001-44192',
      validFrom: '2024-11-15',
      validUntil: '2027-11-14',
      scopeSummary: 'Execution of Civil Structures, Flyovers, Rail Over Bridges & High-Speed Highway Works.',
      status: 'VERIFIED',
      evidenceDocName: 'ISO_9001_Quality_Certificate.pdf',
      evidenceDocSize: '2.4 MB',
      lastVerifiedAt: '2026-09-01',
    },
    {
      id: 'cert-iso-14001',
      title: 'Environmental Management System (ISO 14001:2015)',
      standard: 'ISO 14001:2015',
      issuingBody: 'TÜV Rheinland India',
      certificateNumber: 'TUV-IND-14001-88912',
      validFrom: '2023-12-11',
      validUntil: '2026-12-10',
      scopeSummary: 'Environmental Compliance and Waste Mitigation for Highway & Bridge Construction.',
      status: 'EXPIRING_SOON',
      evidenceDocName: 'ISO_14001_Environment_Certificate.pdf',
      evidenceDocSize: '1.9 MB',
      verificationNotes: 'Recertification audit scheduled for Oct 25, 2026.',
      lastVerifiedAt: '2026-09-01',
    },
    {
      id: 'cert-iso-45001',
      title: 'Occupational Health & Safety (ISO 45001:2018)',
      standard: 'ISO 45001:2018',
      issuingBody: 'TÜV Rheinland India',
      certificateNumber: 'TUV-IND-45001-33109',
      validFrom: '2024-01-21',
      validUntil: '2027-01-20',
      scopeSummary: 'Zero-Harm Safety Management at Construction Work Fronts.',
      status: 'VERIFIED',
      evidenceDocName: 'ISO_45001_Safety_Certificate.pdf',
      evidenceDocSize: '2.1 MB',
      lastVerifiedAt: '2026-09-01',
    },
    {
      id: 'cert-cmmi',
      title: 'CMMI Services & Operations Maturity',
      standard: 'CMMI Maturity Level 3',
      issuingBody: 'ISACA / CMMI Institute',
      certificateNumber: 'CMMI-SVC-L3-2024-098',
      validFrom: '2024-04-01',
      validUntil: '2027-03-31',
      scopeSummary: 'Project Monitoring, ERP Scheduling & Subcontractor Compliance Tracking.',
      status: 'VERIFIED',
      evidenceDocName: 'CMMI_Level3_Appraisal_Statement.pdf',
      evidenceDocSize: '3.2 MB',
      lastVerifiedAt: '2026-09-01',
    },
  ],
  turnoverRecords: [
    {
      id: 'to-fy24',
      title: 'FY 2023-24 Audited Financial Turnover & Net Worth',
      financialYear: 'FY 2023-24',
      turnoverInrCrores: 18.5,
      netWorthInrCrores: 6.8,
      profitAfterTaxCrores: 1.95,
      caFirmName: 'M/s K.S. Joshi & Associates (FRN 108922W)',
      caMembershipNo: '142890',
      caUdin: '24142890AAAAA1234',
      isUdinValidated: true,
      audited: true,
      status: 'VERIFIED',
      evidenceDocName: 'CA_Audited_Turnover_FY2023-24.pdf',
      evidenceDocSize: '3.8 MB',
      lastVerifiedAt: '2026-09-10',
    },
    {
      id: 'to-fy23',
      title: 'FY 2022-23 Audited Financial Turnover & Net Worth',
      financialYear: 'FY 2022-23',
      turnoverInrCrores: 14.2,
      netWorthInrCrores: 5.4,
      profitAfterTaxCrores: 1.45,
      caFirmName: 'M/s K.S. Joshi & Associates (FRN 108922W)',
      caMembershipNo: '142890',
      caUdin: '23142890AAAAA5678',
      isUdinValidated: true,
      audited: true,
      status: 'VERIFIED',
      evidenceDocName: 'CA_Audited_Turnover_FY2022-23.pdf',
      evidenceDocSize: '3.5 MB',
      lastVerifiedAt: '2026-09-10',
    },
    {
      id: 'to-fy22',
      title: 'FY 2021-22 Audited Financial Turnover & Net Worth',
      financialYear: 'FY 2021-22',
      turnoverInrCrores: 11.8,
      netWorthInrCrores: 4.2,
      profitAfterTaxCrores: 1.12,
      caFirmName: 'M/s K.S. Joshi & Associates (FRN 108922W)',
      caMembershipNo: '142890',
      caUdin: '22142890AAAAA9012',
      isUdinValidated: true,
      audited: true,
      status: 'VERIFIED',
      evidenceDocName: 'CA_Audited_Turnover_FY2021-22.pdf',
      evidenceDocSize: '3.1 MB',
      lastVerifiedAt: '2026-09-10',
    },
  ],
  solvencyRecords: [
    {
      id: 'solv-sbi',
      title: 'Bank Solvency Certificate — State Bank of India',
      bankName: 'State Bank of India (Industrial Finance Branch, Mumbai)',
      solvencyLimitInrCrores: 6.0,
      sanctionDate: '2026-04-15',
      validUntil: '2027-04-14',
      accountNumberMasked: 'XXXX-XXXX-4512',
      status: 'VERIFIED',
      evidenceDocName: 'SBI_Solvency_Certificate_6Cr_2026.pdf',
      evidenceDocSize: '1.4 MB',
      lastVerifiedAt: '2026-09-01',
    },
  ],
  pastExperience: [
    {
      id: 'exp-01',
      title: 'Construction of 4-Lane Road Over Bridge (ROB) & Approaches',
      projectTitle: 'Construction of Road Over Bridge (ROB) & Approaches',
      clientName: 'Central Railway (Bhusawal Division)',
      clientType: 'RAILWAY',
      contractValueInrCrores: 12.8,
      completionDate: '2023-12-15',
      locationState: 'Maharashtra',
      scopeHighlights: [
        'RCC substructure with deep pile foundations',
        'Composite steel girder superstructure (45m span)',
        'Approach ramps with reinforced earth (RE) walls',
      ],
      workTypeTags: ['Bridges', 'Civil Substructure', 'Railways'],
      status: 'VERIFIED',
      evidenceDocName: 'Central_Railway_ROB_Completion_Certificate.pdf',
      evidenceDocSize: '4.2 MB',
      lastVerifiedAt: '2026-08-15',
    },
    {
      id: 'exp-02',
      title: 'Highway Flyover Substructure & Foundation Works',
      projectTitle: 'Substructure & Foundation Works for 6-Lane Flyover',
      clientName: 'National Highways Authority of India (NHAI)',
      clientType: 'CENTRAL_GOVT',
      contractValueInrCrores: 9.5,
      completionDate: '2023-03-30',
      locationState: 'Gujarat',
      scopeHighlights: [
        '1200mm dia bored cast-in-situ piling (28m depth)',
        'Pier cap casting with self-compacting concrete',
        'Crash barriers and median drainage installation',
      ],
      workTypeTags: ['Highways', 'Foundations', 'NHAI'],
      status: 'VERIFIED',
      evidenceDocName: 'NHAI_Flyover_Completion_Certificate.pdf',
      evidenceDocSize: '3.9 MB',
      lastVerifiedAt: '2026-08-15',
    },
    {
      id: 'exp-03',
      title: 'Railway Station Yard Upgrade & Track Earthworks',
      projectTitle: 'Civil, Platform Extension & Track Earthworks',
      clientName: 'Western Railway (Vadodara Division)',
      clientType: 'RAILWAY',
      contractValueInrCrores: 6.2,
      completionDate: '2022-11-20',
      locationState: 'Gujarat',
      scopeHighlights: [
        'Station platform lengthening to accommodate 24-coach trains',
        'RCC ballast retaining walls and drainage culverts',
        'Earthworks and formation stabilization',
      ],
      workTypeTags: ['Station Works', 'Earthworks', 'Railways'],
      status: 'VERIFIED',
      evidenceDocName: 'Western_Railway_Station_Completion_Cert.pdf',
      evidenceDocSize: '2.8 MB',
      lastVerifiedAt: '2026-08-15',
    },
  ],
  projects: [
    {
      id: 'proj-01',
      title: 'Elevated Metro Viaduct Package — Substructure Works',
      projectName: 'Elevated Metro Viaduct Package 03',
      clientName: 'Maharashtra Metro Rail Corporation (MahaMetro)',
      role: 'PRIME_CONTRACTOR',
      contractValueInrCrores: 15.4,
      startDate: '2024-02-01',
      endDate: '2026-11-30',
      statusText: 'IN_PROGRESS',
      keyDeliverables: '3.4 km elevated viaduct piers, pier caps, and station portal beams.',
      status: 'VERIFIED',
      evidenceDocName: 'MahaMetro_Work_Order_Agmt.pdf',
      evidenceDocSize: '5.6 MB',
      lastVerifiedAt: '2026-09-01',
    },
  ],
  oemAuthorizations: [
    {
      id: 'oem-tata',
      title: 'Tata Steel — TMT Reinforcement Bars (Fe 550D)',
      oemName: 'Tata Steel Limited',
      partnerTier: 'Tier-1 Authorized Project Partner',
      productCategories: ['TMT Fe 550D / Fe 550D CRS', 'Structural Steel Angles & Channels'],
      authorizedTerritory: 'Maharashtra, Gujarat & Goa',
      validFrom: '2025-01-01',
      validUntil: '2026-12-31',
      mafDocName: 'Tata_Steel_MAF_Authorization_2026.pdf',
      status: 'VERIFIED',
      evidenceDocName: 'Tata_Steel_MAF_Authorization_2026.pdf',
      evidenceDocSize: '1.6 MB',
      lastVerifiedAt: '2026-08-10',
    },
    {
      id: 'oem-schneider',
      title: 'Schneider Electric — Substation HT Panels & Switchgear',
      oemName: 'Schneider Electric India Pvt. Ltd.',
      partnerTier: 'Authorized Systems Integrator',
      productCategories: ['11kV / 33kV Vacuum Circuit Breakers', 'Protection Relays'],
      authorizedTerritory: 'Western Region',
      validFrom: '2024-06-01',
      validUntil: '2027-05-31',
      mafDocName: 'Schneider_Electric_MAF_Agreement.pdf',
      status: 'VERIFIED',
      evidenceDocName: 'Schneider_Electric_MAF_Agreement.pdf',
      evidenceDocSize: '2.1 MB',
      lastVerifiedAt: '2026-08-10',
    },
  ],
  employees: [
    {
      id: 'emp-01',
      title: 'Chief Project Manager — Civil & Bridges',
      name: 'Er. Rajesh V. Patil',
      designation: 'Chief Project Director',
      role: 'PROJECT_MANAGER',
      qualification: 'B.E. (Civil), M.Tech (Structures), PMP Certified',
      experienceYears: 18,
      epfoUan: '100456789123',
      isKeyPersonnel: true,
      status: 'VERIFIED',
      evidenceDocName: 'Er_Rajesh_Patil_CV_Degree_Certificates.pdf',
      evidenceDocSize: '2.2 MB',
      lastVerifiedAt: '2026-09-01',
    },
    {
      id: 'emp-02',
      title: 'Lead Structural & Quality Assurance Engineer',
      name: 'Er. Ananya Mukherjee',
      designation: 'Sr. Quality Assurance Lead',
      role: 'QUALITY_AUDITOR',
      qualification: 'B.Tech (Civil), NDT Level II Certified',
      experienceYears: 12,
      epfoUan: '100987654321',
      isKeyPersonnel: true,
      status: 'VERIFIED',
      evidenceDocName: 'Er_Ananya_Mukherjee_Credentials.pdf',
      evidenceDocSize: '1.7 MB',
      lastVerifiedAt: '2026-09-01',
    },
    {
      id: 'emp-03',
      title: 'EHS & Industrial Safety Officer',
      name: 'Mr. Sunil Kamble',
      designation: 'Safety & Environment Head',
      role: 'SAFETY_OFFICER',
      qualification: 'Diploma in Industrial Safety (DIS), NEBOSH IGC',
      experienceYears: 9,
      epfoUan: '100654321987',
      isKeyPersonnel: true,
      status: 'VERIFIED',
      evidenceDocName: 'Sunil_Kamble_Safety_Certifications.pdf',
      evidenceDocSize: '1.4 MB',
      lastVerifiedAt: '2026-09-01',
    },
  ],
  equipment: [
    {
      id: 'eq-01',
      title: 'Hydraulic Rotary Piling Rig — Bauer BG 28 H',
      name: 'Bauer BG 28 H Rotary Piling Rig',
      modelAndMake: 'Bauer Maschinen GmbH / 2021',
      equipmentType: 'Deep Foundation Rotary Piling',
      quantity: 2,
      ownership: 'OWNED',
      manufactureYear: 2021,
      capacityOrRating: 'Max Pile Dia 2500mm / Depth 65m',
      calibrationValidUntil: '2027-02-15',
      status: 'VERIFIED',
      evidenceDocName: 'Bauer_Piling_Rig_Invoice_RC_Docs.pdf',
      evidenceDocSize: '3.4 MB',
      lastVerifiedAt: '2026-08-20',
    },
    {
      id: 'eq-02',
      title: 'Automated Concrete Batching Plant (60 m³/hr)',
      name: 'Schwing Stetter CP 30 Batching Plant',
      modelAndMake: 'Schwing Stetter India / 2022',
      equipmentType: 'RMC Batching Plant',
      quantity: 1,
      ownership: 'OWNED',
      manufactureYear: 2022,
      capacityOrRating: '60 cubic meters / hour output',
      calibrationValidUntil: '2026-10-30',
      status: 'EXPIRING_SOON',
      evidenceDocName: 'Schwing_Batching_Plant_RC_Calibration.pdf',
      evidenceDocSize: '2.9 MB',
      verificationNotes: 'Annual load cell recalibration due on Oct 30.',
      lastVerifiedAt: '2026-08-20',
    },
    {
      id: 'eq-03',
      title: 'Mobile Hydraulic Crane (80 Tonne Capacity)',
      name: 'ACE 80T All-Terrain Mobile Crane',
      modelAndMake: 'Action Construction Equipment / 2020',
      equipmentType: 'Heavy Lifting Crane',
      quantity: 2,
      ownership: 'OWNED',
      manufactureYear: 2020,
      capacityOrRating: '80 Tonne Safe Working Load (SWL)',
      calibrationValidUntil: '2027-05-10',
      status: 'VERIFIED',
      evidenceDocName: 'ACE_80T_Crane_Fitness_Certificate.pdf',
      evidenceDocSize: '2.1 MB',
      lastVerifiedAt: '2026-08-20',
    },
  ],
  geographicCoverage: [
    {
      id: 'geo-hq',
      title: 'Corporate Headquarters & Technical Design Cell',
      facilityType: 'HEADQUARTERS',
      state: 'Maharashtra',
      city: 'Mumbai',
      address: 'Plot 42, Bandra-Kurla Complex (BKC), Mumbai 400051',
      slaResponseHours: 4,
      serviceStaffCount: 45,
      status: 'VERIFIED',
      evidenceDocName: 'BKC_Registered_Office_Premises_Deed.pdf',
      evidenceDocSize: '2.8 MB',
      lastVerifiedAt: '2026-09-01',
    },
    {
      id: 'geo-pune',
      title: 'Regional Operations Hub & Heavy Equipment Yard',
      facilityType: 'REGIONAL_OFFICE',
      state: 'Maharashtra',
      city: 'Pune',
      address: 'Survey 108, Chakan Industrial Area Phase II, Pune 410501',
      slaResponseHours: 6,
      serviceStaffCount: 28,
      status: 'VERIFIED',
      evidenceDocName: 'Chakan_Yard_Ownership_Tax_Receipts.pdf',
      evidenceDocSize: '3.1 MB',
      lastVerifiedAt: '2026-09-01',
    },
    {
      id: 'geo-gujarat',
      title: 'Gujarat Project Liaison & Rapid Response Center',
      facilityType: 'BRANCH_OFFICE',
      state: 'Gujarat',
      city: 'Vadodara',
      address: 'Tower B, Alkapuri Corporate Arcade, Vadodara 390007',
      slaResponseHours: 8,
      serviceStaffCount: 16,
      status: 'VERIFIED',
      evidenceDocName: 'Vadodara_Branch_GST_Rent_Agreement.pdf',
      evidenceDocSize: '1.9 MB',
      lastVerifiedAt: '2026-09-01',
    },
  ],
  evidenceVault: [
    {
      id: 'doc-gst-01',
      fileName: 'GST_Registration_Certificate_Form_REG06.pdf',
      fileSizeBytes: 1258291,
      docType: 'Statutory Registration',
      uploadedAt: '2026-09-15T10:30:00Z',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      linkedCapabilitiesCount: 2,
      verificationStatus: 'VERIFIED',
    },
    {
      id: 'doc-pan-01',
      fileName: 'Company_PAN_Card_ApexInfra.pdf',
      fileSizeBytes: 860160,
      docType: 'Statutory Identity',
      uploadedAt: '2026-09-15T10:35:00Z',
      sha256Hash: 'a89c31405b8ef981fa1e4df6a4ae748360655d8f9671d1844a4918e954546522',
      linkedCapabilitiesCount: 2,
      verificationStatus: 'VERIFIED',
    },
    {
      id: 'doc-udyam-01',
      fileName: 'Udyam_Registration_Certificate_2026.pdf',
      fileSizeBytes: 1887436,
      docType: 'MSME Certificate',
      uploadedAt: '2026-09-20T14:10:00Z',
      sha256Hash: 'f4122180c4391216503c5825bc54b9d034a17967919e917d598379435b863004',
      linkedCapabilitiesCount: 1,
      verificationStatus: 'VERIFIED',
    },
    {
      id: 'doc-to-24',
      fileName: 'CA_Audited_Turnover_FY2023-24.pdf',
      fileSizeBytes: 3984588,
      docType: 'Audited Financial Statement (UDIN)',
      uploadedAt: '2026-09-10T16:45:00Z',
      sha256Hash: '9b7a4ecf97e26fa0c4dd5a4f4817a01d6706e57cb0991b35e7d956f1406e1db9',
      linkedCapabilitiesCount: 3,
      verificationStatus: 'VERIFIED',
    },
    {
      id: 'doc-cpwd-01',
      fileName: 'CPWD_Class1_Contractor_Enlistment.pdf',
      fileSizeBytes: 2411724,
      docType: 'Contractor Enlistment License',
      uploadedAt: '2026-09-01T09:20:00Z',
      expiryDate: '2026-11-30',
      sha256Hash: '356a192b7913b04c54574d18c28d46e6395428ab',
      linkedCapabilitiesCount: 1,
      verificationStatus: 'EXPIRING_SOON',
    },
    {
      id: 'doc-iso-9001',
      fileName: 'ISO_9001_Quality_Certificate.pdf',
      fileSizeBytes: 2516582,
      docType: 'ISO Quality Certificate',
      uploadedAt: '2026-09-01T09:30:00Z',
      expiryDate: '2027-11-14',
      sha256Hash: 'da4b9237bacccdf19c0760cab7aec4a8359010b0',
      linkedCapabilitiesCount: 2,
      verificationStatus: 'VERIFIED',
    },
  ],
};
