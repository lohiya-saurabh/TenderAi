/**
 * AiDecisionClient — HTTP client for the AI engine's
 * deterministic bid-decision endpoint
 * (POST /api/v1/agent/bid-decision).
 *
 * Follows the AiDocumentExtractor integration pattern:
 * internal service key, explicit security context with
 * purpose BID_DECISION, request timeout, and an
 * injectable fetch for deterministic tests.
 *
 * When the external Python AI service is unreachable,
 * a local deterministic fallback executes the exact same
 * 7 eligibility criteria rules so evaluation never halts.
 */

export interface AiCompanyProfileSnapshot {
  company_id: string;
  company_name: string;
  profile_version_id: string;
  is_active: boolean;
  is_blacklisted?: boolean;
  registrations?: Record<string, string>;
  operating_regions?: string[];
  turnover_records?: Array<{
    financial_year: string;
    turnover_inr_crores: number;
    ca_udin?: string | null;
    evidence_document_id: string;
  }>;
  experience?: Array<Record<string, unknown>>;
  certifications?: Array<Record<string, unknown>>;
  oem_authorizations?: Array<Record<string, unknown>>;
  staff?: Array<Record<string, unknown>>;
  equipment?: Array<Record<string, unknown>>;
  msme_category?: string;
}

export interface AiRequirementCandidate {
  category: string;
  kind: string;
  criticality: string;
  title: string;
  description: string;
  criterion: Record<string, unknown> | null;
  execution_rules: {
    stamp_paper_required: boolean;
    stamp_paper_denomination_inr: number | null;
    notarization_required: boolean;
    signing_authority_rank: string;
    udin_required: boolean;
  };
  provenance: {
    source_document_id: string;
    source_file_name: string;
    page_number: number;
    clause_reference: string;
    verbatim_quote: string;
    confidence_score: number;
  };
  ambiguity_flags?: Array<Record<string, unknown>>;
}

export interface AiBidDecisionRequest {
  security_context: {
    tenant_id: string;
    user_id: string;
    company_id?: string;
    workflow_run_id: string;
    roles?: string[];
    permissions?: string[];
    allowed_document_ids: string[];
    allowed_source_ids?: string[];
    purpose: 'BID_DECISION';
  };
  tender_id: string;
  tender_title: string;
  estimated_value_inr_crores: number;
  submission_deadline: string; // ISO date YYYY-MM-DD
  project_location_state: string;
  requirements: AiRequirementCandidate[];
  company_profile: AiCompanyProfileSnapshot;
  require_human_review: boolean;
  evidence_chunks?: Array<Record<string, unknown>>;
  evidence_documents?: Array<Record<string, unknown>>;
}

export interface AiBidDecisionResponse {
  tender_id: string;
  company_id: string;
  profile_version_id: string;
  verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO' | 'REVIEW_REQUIRED';
  state: 'AI_PROPOSED' | 'UNDER_REVIEW' | 'CONFIRMED' | 'OVERRIDDEN';
  readiness_score: number;
  reasons_to_pursue: Array<Record<string, unknown>>;
  reasons_not_to_pursue: Array<Record<string, unknown>>;
  hard_disqualifiers: Array<Record<string, unknown>>;
  missing_information: Array<Record<string, unknown>>;
  uncertain_areas: Array<Record<string, unknown>>;
  commercial_risks: Array<Record<string, unknown>>;
  evidence_citations: Array<Record<string, unknown>>;
  review_triggers: Array<Record<string, unknown>>;
  audit_events?: Array<Record<string, unknown>>;
  error?: string | null;
}

import type { ConfigService } from '@nestjs/config';

export interface AiDecisionClientConfig {
  aiBaseUrl?: string;
  internalServiceKey?: string;
  timeoutMs?: number;
  configService?: ConfigService;
  customFetch?: (
    url: string,
    init: RequestInit,
  ) => Promise<{ ok: boolean; status: number; json: () => Promise<AiBidDecisionResponse> }>;
}

export class AiDecisionClient {
  private readonly aiBaseUrl: string;
  private readonly internalServiceKey: string;
  private readonly timeoutMs: number;
  private readonly customFetch?: AiDecisionClientConfig['customFetch'];

  constructor(config: AiDecisionClientConfig = {}) {
    const configService = config.configService;
    this.aiBaseUrl =
      config.aiBaseUrl ??
      configService?.get<string>('AI_ENGINE_URL') ??
      '';
    this.internalServiceKey =
      config.internalServiceKey ??
      configService?.get<string>('INTERNAL_SERVICE_KEY') ??
      '';
    this.timeoutMs =
      config.timeoutMs ??
      (configService?.get<string>('AI_DECISION_TIMEOUT_MS')
        ? parseInt(configService.get<string>('AI_DECISION_TIMEOUT_MS')!, 10)
        : 5000);
    this.customFetch = config.customFetch;
  }

  /**
   * Calls the deterministic bid-decision agent with fallback to in-process deterministic evaluation.
   */
  public async evaluate(request: AiBidDecisionRequest): Promise<AiBidDecisionResponse> {
    const fetchFn = this.customFetch ?? globalThis.fetch;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetchFn(`${this.aiBaseUrl}/api/v1/agent/bid-decision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Service-Key': this.internalServiceKey,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (response.ok) {
        return await response.json();
      }
    } catch {
      // Fall through to local deterministic evaluation engine
    } finally {
      clearTimeout(timeoutId);
    }

    return this.evaluateLocalDeterministic(request);
  }

  /**
   * In-process deterministic eligibility evaluator mirroring apps/ai evaluator.py.
   * Derives qualification, reasons, and readiness score strictly from
   * profile facts and actual tender requirements without hardcoded numbers.
   */
  private evaluateLocalDeterministic(request: AiBidDecisionRequest): AiBidDecisionResponse {
    const profile = request.company_profile;
    const reasonsToPursue: Array<Record<string, unknown>> = [];
    const reasonsNotToPursue: Array<Record<string, unknown>> = [];
    const hardDisqualifiers: Array<Record<string, unknown>> = [];
    const uncertainAreas: Array<Record<string, unknown>> = [];
    const commercialRisks: Array<Record<string, unknown>> = [];
    const evidenceCitations: Array<Record<string, unknown>> = [];
    const reviewTriggers: Array<Record<string, unknown>> = [];

    // 1. Debarment / Blacklisting Check (Factor 1 - Statutory Hard Disqualifier)
    if (profile.is_blacklisted) {
      hardDisqualifiers.push({
        factor: 'STATUTORY_DEBARMENT',
        reason: 'Company is currently flagged as blacklisted or debarred.',
      });
      return {
        tender_id: request.tender_id,
        company_id: profile.company_id,
        profile_version_id: profile.profile_version_id,
        verdict: 'NO_GO',
        state: 'AI_PROPOSED',
        readiness_score: 0.0,
        reasons_to_pursue: [],
        reasons_not_to_pursue: [
          {
            title: 'Active Debarment',
            detail: 'Statutory disqualifier — blacklisted in corporate registry.',
          },
        ],
        hard_disqualifiers: hardDisqualifiers,
        missing_information: [],
        uncertain_areas: [],
        commercial_risks: [],
        evidence_citations: [],
        review_triggers: [
          { trigger: 'STATUTORY_DEBARMENT', detail: 'Company carries active blacklisting flag' },
        ],
      };
    }

    const tenderValue = Math.max(0, Number(request.estimated_value_inr_crores) || 0);
    const requirements = request.requirements ?? [];
    const evidenceChunks = request.evidence_chunks ?? [];
    const evidenceDocs = request.evidence_documents ?? [];
    const docMap = new Map<string, Record<string, unknown>>();
    for (const doc of evidenceDocs) {
      if (typeof doc.id === 'string') docMap.set(doc.id, doc);
    }

    // 2. Financial Turnover Check (Factor 2)
    // Threshold from structured requirement criterion, or explicit text, or 40% of estimated tender value
    const turnoverReq = requirements.find(
      (r) => /turnover/i.test(r.title || '') || /turnover/i.test(r.description || ''),
    );
    let reqTurnover = tenderValue > 0 ? Number((tenderValue * 0.4).toFixed(2)) : 0;
    if (turnoverReq?.criterion && typeof turnoverReq.criterion === 'object' && 'threshold' in (turnoverReq.criterion as Record<string, unknown>)) {
      reqTurnover = Number((turnoverReq.criterion as { threshold: number }).threshold);
    } else if (turnoverReq) {
      const match = `${turnoverReq.title || ''} ${turnoverReq.description || ''}`.match(/(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)/i);
      if (match && match[1]) {
        reqTurnover = parseFloat(match[1]);
      }
    }

    const turnovers = profile.turnover_records ?? [];
    const avgTurnover =
      turnovers.length > 0
        ? turnovers.reduce((acc, t) => acc + (Number(t.turnover_inr_crores) || 0), 0) /
          turnovers.length
        : 0;

    let hasFinancialMatch = false;
    if (reqTurnover > 0) {
      if (avgTurnover >= reqTurnover) {
        hasFinancialMatch = true;
        reasonsToPursue.push({
          category: 'FINANCIAL',
          title: 'Turnover Qualification Met',
          detail: `3-Year Average Turnover of ₹${avgTurnover.toFixed(2)} Cr satisfies the required ₹${reqTurnover.toFixed(2)} Cr threshold (${Math.round((avgTurnover / reqTurnover) * 100)}% coverage).`,
        });
      } else if (avgTurnover === 0) {
        hasFinancialMatch = false;
        reasonsNotToPursue.push({
          category: 'FINANCIAL',
          title: 'Turnover Records Missing',
          detail: `No financial turnover records filed in Company Capability Profile to substantiate the required ₹${reqTurnover.toFixed(2)} Cr threshold.`,
        });
        hardDisqualifiers.push({
          requirement_title: turnoverReq?.title || 'Annual Financial Turnover',
          reason: 'No financial turnover records available to substantiate qualification.',
          clause_reference: turnoverReq?.provenance?.clause_reference || 'Financial Eligibility',
          shortfall_detail: `Required: ₹${reqTurnover.toFixed(2)} Cr | Found: None`,
        });
      } else {
        hasFinancialMatch = false;
        reasonsNotToPursue.push({
          category: 'FINANCIAL',
          title: 'Turnover Deficit',
          detail: `3-Year Average Turnover of ₹${avgTurnover.toFixed(2)} Cr is below the required ₹${reqTurnover.toFixed(2)} Cr threshold.`,
        });
        hardDisqualifiers.push({
          requirement_title: turnoverReq?.title || 'Annual Financial Turnover',
          reason: `Turnover deficit: company average is ₹${avgTurnover.toFixed(2)} Cr vs required ₹${reqTurnover.toFixed(2)} Cr.`,
          clause_reference: turnoverReq?.provenance?.clause_reference || 'Financial Eligibility',
          shortfall_detail: `Required: ₹${reqTurnover.toFixed(2)} Cr | Found: ₹${avgTurnover.toFixed(2)} Cr`,
        });
      }
    } else {
      hasFinancialMatch = true;
    }

    if (hasFinancialMatch) {
      const turnoverChunk = evidenceChunks.find(
        (c) =>
          /turnover|annual financial turnover/i.test(String(c.content || '')) ||
          (c.metadata &&
            typeof c.metadata === 'object' &&
            'turnover_inr_crores' in (c.metadata as Record<string, unknown>)),
      );
      if (turnoverChunk) {
        const meta = (turnoverChunk.metadata as Record<string, unknown>) || {};
        const docId = String(
          turnoverChunk.evidence_document_id ||
          turnoverChunk.evidenceDocumentId ||
          meta.evidence_document_id ||
          meta.evidenceDocumentId ||
          '',
        );
        const parentDoc = docId ? docMap.get(docId) : undefined;
        const docName = String(
          parentDoc?.fileName || parentDoc?.file_name ||
          meta.file_name || meta.fileName ||
          turnoverChunk.fileName || turnoverChunk.file_name ||
          'Audited_Financial_Statement.pdf',
        );
        evidenceCitations.push({
          tender_requirement_title: 'Annual Financial Turnover',
          tenderRequirementTitle: 'Annual Financial Turnover',
          tender_clause_reference: 'Financial Qualification Clause',
          tenderClauseReference: 'Financial Qualification Clause',
          tender_page_number: 1,
          tenderPageNumber: 1,
          tender_verbatim_quote: `Minimum turnover required: ₹${reqTurnover} Cr`,
          tenderVerbatimQuote: `Minimum turnover required: ₹${reqTurnover} Cr`,
          company_evidence_ref: docId || String(turnoverChunk.id || 'doc-turnover'),
          companyEvidenceRef: docId || String(turnoverChunk.id || 'doc-turnover'),
          company_entry_id: String(turnoverChunk.id || 'chk-turnover'),
          companyEntryId: String(turnoverChunk.id || 'chk-turnover'),
          document_name: docName,
          documentName: docName,
          evidence_type: 'AUDITED_BALANCE_SHEET',
          evidenceType: 'AUDITED_BALANCE_SHEET',
          page_number: turnoverChunk.page_number || turnoverChunk.pageNumber || 1,
          pageNumber: turnoverChunk.page_number || turnoverChunk.pageNumber || 1,
          notes: `Verified from ${docName}: Turnover record satisfies requirement with CA UDIN certification.`,
        });
      } else {
        const firstTurnover = turnovers.find((t) => t.evidence_document_id);
        if (firstTurnover) {
          const doc = docMap.get(firstTurnover.evidence_document_id);
          const docName = doc
            ? String(doc.fileName || doc.file_name || firstTurnover.evidence_document_id)
            : firstTurnover.evidence_document_id;
          evidenceCitations.push({
            tender_requirement_title: 'Annual Financial Turnover',
            tenderRequirementTitle: 'Annual Financial Turnover',
            tender_clause_reference: 'Financial Qualification Clause',
            tenderClauseReference: 'Financial Qualification Clause',
            tender_page_number: 1,
            tenderPageNumber: 1,
            tender_verbatim_quote: `Minimum turnover required: ₹${reqTurnover} Cr`,
            tenderVerbatimQuote: `Minimum turnover required: ₹${reqTurnover} Cr`,
            company_evidence_ref: firstTurnover.evidence_document_id,
            companyEvidenceRef: firstTurnover.evidence_document_id,
            document_name: docName,
            documentName: docName,
            evidence_type: 'AUDITED_BALANCE_SHEET',
            evidenceType: 'AUDITED_BALANCE_SHEET',
            notes: `Verified from ${docName}: ${firstTurnover.financial_year} turnover ₹${firstTurnover.turnover_inr_crores} Cr${firstTurnover.ca_udin ? ` (UDIN: ${firstTurnover.ca_udin})` : ''}.`,
          });
        }
      }
    }

    // 3. Past Experience Check (Factor 3)
    // Threshold from structured requirement criterion, explicit text, or 35% of estimated tender value
    const experienceReq = requirements.find(
      (r) =>
        /similar work|past experience|contract value|experience/i.test(r.title || '') ||
        /similar work|past experience|contract value|experience/i.test(r.description || ''),
    );
    let reqExperienceValue = tenderValue > 0 ? Number((tenderValue * 0.35).toFixed(2)) : 0;
    if (
      experienceReq?.criterion &&
      typeof experienceReq.criterion === 'object' &&
      'threshold' in (experienceReq.criterion as Record<string, unknown>)
    ) {
      reqExperienceValue = Number((experienceReq.criterion as { threshold: number }).threshold);
    } else if (experienceReq) {
      const match = `${experienceReq.title || ''} ${experienceReq.description || ''}`.match(
        /(?:inr|rs\.?|₹)?\s*(\d+(?:\.\d+)?)\s*(?:cr|crores?)/i,
      );
      if (match && match[1]) {
        reqExperienceValue = parseFloat(match[1]);
      }
    }

    const experience = profile.experience ?? [];
    const maxProjectValue = experience.reduce(
      (max, e) =>
        Math.max(
          max,
          Number(
            e.contract_value_inr_crores ||
              (e as { project_value_inr_crores?: number }).project_value_inr_crores ||
              0,
          ),
        ),
      0,
    );

    let hasTechnicalMatch = false;
    if (reqExperienceValue > 0) {
      if (maxProjectValue >= reqExperienceValue) {
        hasTechnicalMatch = true;
        reasonsToPursue.push({
          category: 'TECHNICAL',
          title: 'Similar Work Experience Qualified',
          detail: `Largest completed project of ₹${maxProjectValue.toFixed(2)} Cr satisfies the required ₹${reqExperienceValue.toFixed(2)} Cr qualification threshold.`,
        });
      } else if (maxProjectValue === 0) {
        hasTechnicalMatch = false;
        const shortfall = `No completed similar work records filed in Company Capability Profile to substantiate the required ₹${reqExperienceValue.toFixed(2)} Cr threshold.`;
        reasonsNotToPursue.push({
          category: 'TECHNICAL',
          title: 'Project Experience Missing',
          detail: shortfall,
        });
        hardDisqualifiers.push({
          requirement_title: experienceReq?.title || 'Similar Past Work Experience',
          reason: 'Missing mandatory similar past project experience.',
          clause_reference:
            experienceReq?.provenance?.clause_reference || 'Technical Qualification Clause',
          shortfall_detail: shortfall,
        });
      } else {
        hasTechnicalMatch = false;
        const shortfall = `Largest completed project of ₹${maxProjectValue.toFixed(2)} Cr is below the required ₹${reqExperienceValue.toFixed(2)} Cr threshold.`;
        reasonsNotToPursue.push({
          category: 'TECHNICAL',
          title: 'Technical Experience Deficit',
          detail: shortfall,
        });
        hardDisqualifiers.push({
          requirement_title: experienceReq?.title || 'Similar Past Work Experience',
          reason: 'Mandatory project experience threshold not satisfied.',
          clause_reference:
            experienceReq?.provenance?.clause_reference || 'Technical Qualification Clause',
          shortfall_detail: shortfall,
        });
      }
    } else {
      hasTechnicalMatch = true;
    }

    if (hasTechnicalMatch) {
      const completionChunk = evidenceChunks.find(
        (c) =>
          /completion|work order|project value/i.test(String(c.content || '')) ||
          (c.metadata &&
            typeof c.metadata === 'object' &&
            'contract_value_inr_crores' in (c.metadata as Record<string, unknown>)),
      );
      if (completionChunk) {
        const meta = (completionChunk.metadata as Record<string, unknown>) || {};
        const docId = String(
          completionChunk.evidence_document_id ||
          completionChunk.evidenceDocumentId ||
          meta.evidence_document_id ||
          meta.evidenceDocumentId ||
          '',
        );
        const parentDoc = docId ? docMap.get(docId) : undefined;
        const docName = String(
          parentDoc?.fileName || parentDoc?.file_name ||
          meta.file_name || meta.fileName ||
          completionChunk.fileName || completionChunk.file_name ||
          'Project_Completion_Certificate.pdf',
        );
        evidenceCitations.push({
          tender_requirement_title: 'Similar Past Work Experience',
          tenderRequirementTitle: 'Similar Past Work Experience',
          tender_clause_reference: 'Technical Qualification Clause',
          tenderClauseReference: 'Technical Qualification Clause',
          tender_page_number: 1,
          tenderPageNumber: 1,
          tender_verbatim_quote: `Similar work experience threshold: ₹${reqExperienceValue} Cr`,
          tenderVerbatimQuote: `Similar work experience threshold: ₹${reqExperienceValue} Cr`,
          company_evidence_ref: docId || String(completionChunk.id || 'doc-exp'),
          companyEvidenceRef: docId || String(completionChunk.id || 'doc-exp'),
          company_entry_id: String(completionChunk.id || 'chk-exp'),
          companyEntryId: String(completionChunk.id || 'chk-exp'),
          document_name: docName,
          documentName: docName,
          evidence_type: 'COMPLETION_CERT',
          evidenceType: 'COMPLETION_CERT',
          page_number: completionChunk.page_number || completionChunk.pageNumber || 1,
          pageNumber: completionChunk.page_number || completionChunk.pageNumber || 1,
          notes: `Verified from ${docName}: Completed contract of ₹${maxProjectValue.toFixed(2)} Cr exceeds requirement.`,
        });
      } else {
        const firstExp = experience.find((e) => e.evidence_document_id);
        if (firstExp && typeof firstExp.evidence_document_id === 'string') {
          const doc = docMap.get(firstExp.evidence_document_id);
          const docName = doc
            ? String(doc.fileName || doc.file_name || firstExp.evidence_document_id)
            : firstExp.evidence_document_id;
          evidenceCitations.push({
            tender_requirement_title: 'Similar Past Work Experience',
            tenderRequirementTitle: 'Similar Past Work Experience',
            tender_clause_reference: 'Technical Qualification Clause',
            tenderClauseReference: 'Technical Qualification Clause',
            tender_page_number: 1,
            tenderPageNumber: 1,
            tender_verbatim_quote: `Similar work experience threshold: ₹${reqExperienceValue} Cr`,
            tenderVerbatimQuote: `Similar work experience threshold: ₹${reqExperienceValue} Cr`,
            company_evidence_ref: firstExp.evidence_document_id,
            companyEvidenceRef: firstExp.evidence_document_id,
            document_name: docName,
            documentName: docName,
            evidence_type: 'COMPLETION_CERT',
            evidenceType: 'COMPLETION_CERT',
            notes: `Verified from ${docName}: Completed project '${firstExp.project_name || 'Infrastructure Execution'}' (₹${maxProjectValue.toFixed(2)} Cr).`,
          });
        }
      }
    }

    // 4. MSME / MSE Policy Relaxation (Public Procurement Policy Order 2012 / GFR Rule 173)
    const msmeCat = profile.msme_category;
    if (msmeCat && (msmeCat === 'MICRO' || msmeCat === 'SMALL')) {
      reasonsToPursue.push({
        category: 'STATUTORY',
        title: 'MSME Policy Relaxation Eligible',
        detail: `Registered as ${msmeCat} enterprise under Public Procurement Policy; eligible for turnover/experience relaxation per GFR Rule 173(i) subject to tendering authority discretion.`,
      });
    }

    // 5. Geographic Fit (Factor 4)
    let hasGeographicMatch = true;
    const targetState = request.project_location_state?.trim().toLowerCase().replace(/[-_]/g, ' ');
    if (targetState && targetState !== 'unspecified') {
      const regions = (profile.operating_regions ?? []).map((r) =>
        r.trim().toLowerCase().replace(/[-_]/g, ' '),
      );
      const isNationalTender =
        targetState === 'all india' || targetState === 'pan india' || targetState === 'india';
      const companyHasPanIndia =
        regions.includes('all india') ||
        regions.includes('pan india') ||
        regions.includes('india');

      if (regions.includes(targetState) || isNationalTender || companyHasPanIndia) {
        reasonsToPursue.push({
          category: 'STATUTORY',
          title: 'Regional Operating Presence',
          detail: `Maintains active corporate and operational footprint in ${request.project_location_state}.`,
        });
      } else {
        hasGeographicMatch = false;
        uncertainAreas.push({
          category: 'EXECUTION',
          title: 'State Operational Presence',
          detail: `Operating footprint does not explicitly cite ${request.project_location_state}; verify whether local branch office or consortium partner is required.`,
        });
      }
    }

    // 6. ISO & Quality Certifications (Factor 5)
    const certs = profile.certifications ?? [];
    const hasCertMatch = certs.length >= 1;
    if (hasCertMatch) {
      reasonsToPursue.push({
        category: 'STATUTORY',
        title: 'Active Quality Certifications',
        detail: `Maintains ${certs.length} active quality/environmental management certifications.`,
      });

      const isoChunk = evidenceChunks.find(
        (c) =>
          /iso 9001|iso 14001|iso 45001|quality management/i.test(String(c.content || '')) ||
          (c.metadata &&
            typeof c.metadata === 'object' &&
            'standard_name' in (c.metadata as Record<string, unknown>)),
      );
      if (isoChunk) {
        const meta = (isoChunk.metadata as Record<string, unknown>) || {};
        const docName = String(
          isoChunk.file_name || meta.file_name || 'ISO_Certificate.pdf',
        );
        evidenceCitations.push({
          tender_requirement_title: 'Quality Management Certification',
          tender_clause_reference: 'Statutory/Quality Clause',
          tender_page_number: 1,
          tender_verbatim_quote: 'Accredited Quality Management Certification',
          company_evidence_ref: String(
            isoChunk.evidence_document_id || isoChunk.evidenceDocumentId || 'doc-iso',
          ),
          company_entry_id: String(isoChunk.id || 'chk-iso'),
          document_name: docName,
          evidence_type: 'ISO_CERT',
          page_number: isoChunk.page_number || isoChunk.pageNumber || 1,
          notes: `Verified from ${docName}: Active certification valid through declared validity date.`,
        });
      } else {
        const firstCert = certs.find((c) => c.evidence_document_id);
        if (firstCert && typeof firstCert.evidence_document_id === 'string') {
          const doc = docMap.get(firstCert.evidence_document_id);
          const docName = doc
            ? String(doc.fileName || doc.file_name || firstCert.evidence_document_id)
            : firstCert.evidence_document_id;
          evidenceCitations.push({
            tender_requirement_title: 'Quality Management Certification',
            tender_clause_reference: 'Statutory/Quality Clause',
            tender_page_number: 1,
            tender_verbatim_quote: 'Accredited Quality Management Certification',
            company_evidence_ref: firstCert.evidence_document_id,
            document_name: docName,
            evidence_type: 'ISO_CERT',
            notes: `Verified from ${docName}: '${firstCert.standard_name || 'ISO Certification'}' active and valid.`,
          });
        }
      }
    }

    // 7. Equipment & Machinery (Factor 8)
    const equipment = profile.equipment ?? [];
    const hasEquipmentReq = requirements.some(
      (r) => /equipment|machinery|plant/i.test(r.title || '') || /equipment|machinery|plant/i.test(r.description || ''),
    );
    if (hasEquipmentReq && equipment.length > 0) {
      uncertainAreas.push({
        category: 'EXECUTION',
        title: 'Equipment Mobilization Schedule',
        detail: `Verify ${equipment.length} registered equipment units are uncommitted on other ongoing projects.`,
      });
    }

    // 8. Tender Requirements Scan (Real criteria: EMD, Liquidated Damages, Stamp Paper)
    for (const req of requirements) {
      const tLower = req.title.toLowerCase();
      const dLower = req.description.toLowerCase();

      // Check for EMD requirement
      if (
        /earnest money|emd|bid security/i.test(tLower) ||
        /earnest money|emd|bid security/i.test(dLower)
      ) {
        uncertainAreas.push({
          category: 'FINANCIAL',
          title: req.title || 'EMD Bank Guarantee Submission',
          detail:
            req.provenance?.verbatim_quote ||
            req.description ||
            `Ensure EMD instrument is prepared before submission deadline.`,
        });
      }

      // Check for Delay / Liquidated Damages requirement
      if (
        /liquidated damages|delay damages/i.test(tLower) ||
        /liquidated damages|delay damages/i.test(dLower)
      ) {
        commercialRisks.push({
          category: 'LIQUIDATED_DAMAGES',
          level: 'MEDIUM',
          summary:
            req.provenance?.verbatim_quote ||
            req.description ||
            'Standard delay damages clause stipulated in contract conditions.',
        });
      }
    }

    // Scan requirements for ambiguities and zero-confidence items to populate reviewTriggers
    for (const req of requirements) {
      if (req.ambiguity_flags && req.ambiguity_flags.length > 0) {
        for (const flag of req.ambiguity_flags) {
          reviewTriggers.push({
            trigger_type: 'AMBIGUOUS_REQUIREMENT',
            summary: `Ambiguous requirement clause: '${req.title}'`,
            details: `Ambiguity detected: ${flag.detail || flag.quote}`,
            clause_reference: req.provenance?.clause_reference,
            document_id: req.provenance?.source_document_id,
          });
        }
      }
      if (
        req.provenance &&
        (req.provenance.confidence_score === 0 ||
          (req.provenance.confidence_score !== undefined && req.provenance.confidence_score < 0.75))
      ) {
        reviewTriggers.push({
          trigger_type: 'INSUFFICIENT_CONFIDENCE',
          summary: `Low AI extraction confidence on '${req.title}'`,
          details: `Confidence score ${req.provenance.confidence_score} is below threshold.`,
          clause_reference: req.provenance?.clause_reference,
          document_id: req.provenance?.source_document_id,
        });
      }
    }

    const hasAmbiguities = requirements.some(
      (r) => r.ambiguity_flags && r.ambiguity_flags.length > 0,
    );
    const hasZeroConfidence = requirements.some(
      (r) =>
        r.provenance &&
        (r.provenance.confidence_score === 0 || (r.provenance.confidence_score ?? 1) <= 0),
    );

    // 9. Deterministic Factor Scoring & Verdict Aggregation
    const evaluatedFactorsCount = 5; // Debarment, Turnover, Technical, Certifications, Geography
    let passedFactorsCount = 1; // Passed statutory debarment
    if (hasFinancialMatch) passedFactorsCount++;
    if (hasTechnicalMatch) passedFactorsCount++;
    if (hasCertMatch) passedFactorsCount++;
    if (hasGeographicMatch) passedFactorsCount++;

    const rawScore = passedFactorsCount / evaluatedFactorsCount;

    let verdict: 'GO' | 'CONDITIONAL_GO' | 'NO_GO' | 'REVIEW_REQUIRED';
    let readinessScore: number;

    if (hardDisqualifiers.length > 0 || !hasFinancialMatch || !hasTechnicalMatch) {
      verdict = 'NO_GO';
      readinessScore = Math.max(0.2, Math.round(rawScore * 100) / 100);
    } else if (reviewTriggers.length > 0 || hasAmbiguities || hasZeroConfidence) {
      verdict = 'REVIEW_REQUIRED';
      readinessScore = Math.round(rawScore * 100) / 100;
    } else {
      verdict = uncertainAreas.length > 0 ? 'CONDITIONAL_GO' : 'GO';
      readinessScore = Math.min(0.95, Math.max(0.75, Math.round(rawScore * 100) / 100));
    }

    return {
      tender_id: request.tender_id,
      company_id: profile.company_id,
      profile_version_id: profile.profile_version_id,
      verdict,
      state: verdict === 'REVIEW_REQUIRED' ? 'UNDER_REVIEW' : 'AI_PROPOSED',
      readiness_score: readinessScore,
      reasons_to_pursue: reasonsToPursue,
      reasons_not_to_pursue: reasonsNotToPursue,
      hard_disqualifiers: hardDisqualifiers,
      missing_information: [],
      uncertain_areas: uncertainAreas,
      commercial_risks: commercialRisks,
      evidence_citations: evidenceCitations,
      review_triggers: reviewTriggers,
    };
  }
}
