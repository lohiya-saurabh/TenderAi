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
import { ServiceUnavailableError } from '@/common/errors/errors.js';

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
    this.aiBaseUrl = config.aiBaseUrl ?? configService?.get<string>('AI_ENGINE_URL') ?? '';
    this.internalServiceKey =
      config.internalServiceKey ?? configService?.get<string>('INTERNAL_SERVICE_KEY') ?? '';
    this.timeoutMs =
      config.timeoutMs ??
      (configService?.get<string>('AI_DECISION_TIMEOUT_MS')
        ? parseInt(configService.get<string>('AI_DECISION_TIMEOUT_MS')!, 10)
        : 5000);
    this.customFetch = config.customFetch;
  }

  /**
   * Calls the bid-decision engine in the AI worker. A failure is reported, never replaced by a
   * second local evaluator: two engines drift, and the user would not know which one answered.
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
      throw new ServiceUnavailableError(
        `The bid-decision engine answered HTTP ${response.status}. Try again in a minute.`,
      );
    } catch (err) {
      if (err instanceof ServiceUnavailableError) throw err;
      throw new ServiceUnavailableError(
        'The bid-decision engine is unreachable right now. Try again in a minute.',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
