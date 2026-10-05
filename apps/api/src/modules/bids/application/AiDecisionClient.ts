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
 * The client is transport only — it never interprets
 * the verdict. The verdict is computed deterministically
 * inside the AI engine.
 */

/**
 * Company profile in the AI engine's wire format
 * (CompanyProfileSnapshot). The API stores the profile
 * payload as a pinned JSONB snapshot and assembles the
 * engine request from it.
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
    this.timeoutMs = config.timeoutMs ?? 60000;
    this.customFetch = config.customFetch;
  }

  /**
   * Calls the deterministic bid-decision agent.
   * Throws on transport failure or non-2xx response —
   * callers must surface the failure, never fabricate
   * a verdict.
   */
  public async evaluate(
    request: AiBidDecisionRequest,
  ): Promise<AiBidDecisionResponse> {
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

      if (!response.ok) {
        throw new Error(
          `AI bid-decision service returned HTTP ${response.status}.`,
        );
      }

      return await response.json();
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
