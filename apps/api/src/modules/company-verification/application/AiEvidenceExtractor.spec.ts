import { describe, it, expect, vi } from 'vitest';
import { AiEvidenceExtractor } from '@/modules/company-verification/application/AiEvidenceExtractor.js';
import type { CompanyEvidenceDocument } from '@/common/database/schema.js';

describe('AiEvidenceExtractor', () => {
  const dummyDoc: CompanyEvidenceDocument = {
    id: 'ev_test_1',
    organizationId: 'org_test_1',
    companyId: 'comp_test_1',
    fileName: 'CA_Turnover_Certificate.pdf',
    storagePath:
      'tenants/org_test_1/companies/comp_test_1/evidence/ev_test_1/CA_Turnover_Certificate.pdf',
    fileSizeBytes: 1024,
    mimeType: 'application/pdf',
    sha256Hash: 'dummyhash',
    evidenceType: 'AUDITED_BALANCE_SHEET',
    issuer: null,
    referenceNumber: null,
    validFrom: null,
    validTo: null,
    sourceProvider: 'LOCAL_UPLOAD',
    sourceReference: null,
    importedAt: new Date(),
    verificationStatus: 'IMPORTED',
    verificationMethod: null,
    verifiedAt: null,
    verifiedBy: null,
    discrepancyNotes: null,
    extractedAttributes: null,
    metadata: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('should call remote AI extraction endpoint when customFetch is provided', async () => {
    const mockResponse = {
      evidence_document_id: 'ev_test_1',
      organization_id: 'org_test_1',
      company_id: 'comp_test_1',
      status: 'COMPLETED',
      extracted_attributes: {
        udin: '25089745AAAAAA1234',
        average_turnover_inr_cr: 281.9,
      },
      chunks: [
        {
          chunk_index: 0,
          chunk_type: 'FINANCIAL_TURNOVER',
          content: 'Audited Turnover: INR 320.5 Cr, UDIN: 25089745AAAAAA1234',
          page_number: 1,
          clause_reference: 'CA Turnover Certificate (Page 1)',
          metadata: { udin: '25089745AAAAAA1234' },
        },
      ],
    };

    const customFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockResponse,
    });

    const extractor = new AiEvidenceExtractor({
      aiBaseUrl: 'http://mock-ai:8000',
      internalServiceKey: 'test-secret',
      customFetch: customFetch as unknown as typeof fetch,
    });

    const result = await extractor.extractEvidence(dummyDoc, undefined, 'http://presigned.url');

    expect(customFetch).toHaveBeenCalledTimes(1);
    expect(result.status).toBe('COMPLETED');
    expect(result.extracted_attributes.udin).toBe('25089745AAAAAA1234');
    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0]?.chunk_type).toBe('FINANCIAL_TURNOVER');
  });

  it('reports a failed remote extraction instead of extracting locally', async () => {
    const extractor = new AiEvidenceExtractor({
      customFetch: vi
        .fn()
        .mockRejectedValue(new Error('connect ECONNREFUSED')) as unknown as typeof fetch,
    });
    const result = await extractor.extractEvidence(
      dummyDoc,
      undefined,
      undefined,
      'UDIN: 25089745AAAAAA1234',
    );
    expect(result.status).toBe('FAILED');
    expect(result.extracted_attributes).toEqual({});
    expect(result.chunks).toEqual([]);
    expect(result.error).toContain('ECONNREFUSED');
  });
});
