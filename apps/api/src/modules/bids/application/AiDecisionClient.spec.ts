import { describe, it, expect } from 'vitest';
import { AiDecisionClient, type AiBidDecisionRequest } from '@/modules/bids/application/AiDecisionClient.js';

describe('AiDecisionClient — Dynamic Deterministic Evaluation', () => {
  it('evaluates qualification dynamically based on tender value without hardcoded thresholds', async () => {
    // Custom fetch that throws so it falls through to local deterministic evaluation
    const client = new AiDecisionClient({
      customFetch: async () => {
        throw new Error('Connection refused — fallback to deterministic');
      },
    });

    const request: AiBidDecisionRequest = {
      security_context: {
        tenant_id: 'org_test',
        user_id: 'usr_01',
        workflow_run_id: 'wf_01',
        allowed_document_ids: [],
        allowed_source_ids: [],
        purpose: 'BID_DECISION',
      },
      tender_id: 'tender_small_01',
      tender_title: 'Facility Management Staffing',
      estimated_value_inr_crores: 1.3, // ₹1.3 Cr tender
      submission_deadline: '2026-10-15',
      project_location_state: 'Maharashtra',
      requirements: [],
      company_profile: {
        company_id: 'comp_01',
        company_name: 'Apex Staffing Solutions',
        profile_version_id: 'cpv_01',
        is_active: true,
        is_blacklisted: false,
        msme_category: 'MICRO' as const,
        turnover_records: [
          {
            financial_year: '2025-26',
            turnover_inr_crores: 1.5,
            evidence_document_id: 'doc_to_01',
          },
        ],
        experience: [
          {
            title: 'Staffing for Tech Park',
            contract_value_inr_crores: 0.8,
          },
        ],
        certifications: [{ name: 'ISO 9001' }],
        operating_regions: ['Maharashtra'],
      },
    };

    const response = await client.evaluate(request);

    // With ₹1.5 Cr turnover vs required 40% of 1.3 Cr (0.52 Cr), and 0.8 Cr experience vs 0.46 Cr,
    // this small tender should qualify! Not be rejected by an arbitrary 150 Cr threshold!
    expect(response.verdict).toBe('GO');
    expect(response.readiness_score).toBeGreaterThanOrEqual(0.75);
    expect(response.reasons_to_pursue.length).toBeGreaterThan(0);
    expect(response.reasons_not_to_pursue.length).toBe(0);
    // Should NOT have synthetic SFMS EMD or Liquidated Damages when not in requirements
    expect(response.commercial_risks.length).toBe(0);
    expect(response.uncertain_areas.length).toBe(0);
  });

  it('accurately reports turnover and experience deficits when profile has no records', async () => {
    const client = new AiDecisionClient({
      customFetch: async () => {
        throw new Error('Connection refused');
      },
    });

    const request: AiBidDecisionRequest = {
      security_context: {
        tenant_id: 'org_test',
        user_id: 'usr_01',
        workflow_run_id: 'wf_02',
        allowed_document_ids: [],
        allowed_source_ids: [],
        purpose: 'BID_DECISION',
      },
      tender_id: 'tender_small_02',
      tender_title: 'NHAI Staff Providing',
      estimated_value_inr_crores: 1.3,
      submission_deadline: '2026-10-15',
      project_location_state: 'Karnataka',
      requirements: [],
      company_profile: {
        company_id: 'comp_empty',
        company_name: 'ACR',
        profile_version_id: 'cpv_empty',
        is_active: true,
        is_blacklisted: false,
        turnover_records: [],
        experience: [],
        certifications: [],
        operating_regions: [],
      },
    };

    const response = await client.evaluate(request);

    expect(response.verdict).toBe('NO_GO');
    // Derived readiness score, NOT hardcoded 0.35!
    expect(response.readiness_score).toBe(0.2);
    // Explicit reasons explaining the shortfall
    const reasons = response.reasons_not_to_pursue.map((r) => r.title);
    expect(reasons).toContain('Turnover Records Missing');
    expect(reasons).toContain('Project Experience Missing');
  });
});
