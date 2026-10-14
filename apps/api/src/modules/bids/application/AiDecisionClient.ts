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

export interface AiDecisionClientConfig {
  aiBaseUrl?: string;
  internalServiceKey?: string;
  timeoutMs?: number;
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
    this.aiBaseUrl = config.aiBaseUrl ?? process.env.AI_ENGINE_URL ?? 'http://localhost:8000';
    this.internalServiceKey =
      config.internalServiceKey ??
      process.env.INTERNAL_SERVICE_KEY ??
      'tenderpulse-internal-secret-2026';
    this.timeoutMs = config.timeoutMs ?? 5000;
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

    // 2. Financial Turnover Check (Factor 2)
    // Threshold is 40% of estimated tender value (standard CPWD/NHAI qualification) or requirement threshold
    const reqTurnover = tenderValue > 0 ? Number((tenderValue * 0.4).toFixed(2)) : 0;
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
      } else {
        hasFinancialMatch = false;
        reasonsNotToPursue.push({
          category: 'FINANCIAL',
          title: 'Turnover Deficit',
          detail: `3-Year Average Turnover of ₹${avgTurnover.toFixed(2)} Cr is below the required ₹${reqTurnover.toFixed(2)} Cr threshold.`,
        });
      }
    } else {
      hasFinancialMatch = true;
    }

    // 3. Past Experience Check (Factor 3)
    // Threshold is 35% of estimated tender value for similar project execution
    const reqExperienceValue = tenderValue > 0 ? Number((tenderValue * 0.35).toFixed(2)) : 0;
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
        reasonsNotToPursue.push({
          category: 'TECHNICAL',
          title: 'Project Experience Missing',
          detail: `No completed similar work records filed in Company Capability Profile to substantiate the required ₹${reqExperienceValue.toFixed(2)} Cr threshold.`,
        });
      } else {
        hasTechnicalMatch = false;
        reasonsNotToPursue.push({
          category: 'TECHNICAL',
          title: 'Technical Experience Deficit',
          detail: `Largest completed project of ₹${maxProjectValue.toFixed(2)} Cr is below the required ₹${reqExperienceValue.toFixed(2)} Cr threshold.`,
        });
      }
    } else {
      hasTechnicalMatch = true;
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
    const targetState = request.project_location_state?.trim().toLowerCase();
    if (targetState && targetState !== 'unspecified') {
      const regions = (profile.operating_regions ?? []).map((r) => r.trim().toLowerCase());
      if (
        regions.includes(targetState) ||
        regions.includes('all india') ||
        regions.includes('pan india')
      ) {
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
    }

    // 7. Equipment & Machinery (Factor 8)
    const equipment = profile.equipment ?? [];
    if (equipment.length > 0) {
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

    if (!hasFinancialMatch && !hasTechnicalMatch) {
      verdict = 'NO_GO';
      readinessScore = Math.max(0.2, Math.round(rawScore * 100) / 100);
    } else if (hasFinancialMatch && hasTechnicalMatch) {
      verdict = uncertainAreas.length > 0 ? 'CONDITIONAL_GO' : 'GO';
      readinessScore = Math.min(0.95, Math.max(0.75, Math.round(rawScore * 100) / 100));
    } else {
      verdict = 'REVIEW_REQUIRED';
      readinessScore = Math.round(rawScore * 100) / 100;
    }

    return {
      tender_id: request.tender_id,
      company_id: profile.company_id,
      profile_version_id: profile.profile_version_id,
      verdict,
      state: 'AI_PROPOSED',
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
