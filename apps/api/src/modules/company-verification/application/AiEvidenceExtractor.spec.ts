import { describe, it, expect, vi } from 'vitest';
import { AiEvidenceExtractor } from '@/modules/company-verification/application/AiEvidenceExtractor.js';
import type { CompanyEvidenceDocument } from '@/common/database/schema.js';

describe('AiEvidenceExtractor', () => {
  const dummyDoc: CompanyEvidenceDocument = {
    id: 'ev_test_1',
    organizationId: 'org_test_1',
    companyId: 'comp_test_1',
    fileName: 'CA_Turnover_Certificate.pdf',
    storagePath: 'tenants/org_test_1/companies/comp_test_1/evidence/ev_test_1/CA_Turnover_Certificate.pdf',
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

  it('should fallback to local deterministic extractor when remote service fails', async () => {
    const customFetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const extractor = new AiEvidenceExtractor({
      aiBaseUrl: 'http://down-service:8000',
      customFetch: customFetch as unknown as typeof fetch,
    });

    const bufferText = 'Audited Financial Statements for FY 2024-25: Turnover INR 320.5 Crores, UDIN: 25089745AAAAAA1234';
    const result = await extractor.extractEvidence(dummyDoc, undefined, undefined, bufferText);

    expect(result.status).toBe('COMPLETED');
    expect(result.extracted_attributes.udin).toBe('25089745AAAAAA1234');
    expect(result.extracted_attributes.average_turnover_inr_cr).toBe(320.5);
    expect(result.chunks.length).toBe(1);
    expect(result.chunks[0]?.chunk_type).toBe('FINANCIAL_TURNOVER');
  });

  it('should extract project experience locally for completion certificates', async () => {
    const doc: CompanyEvidenceDocument = {
      ...dummyDoc,
      fileName: 'NHAI_STRR_Completion.pdf',
      evidenceType: 'COMPLETION_CERT',
    };
    const bufferText = 'NHAI Completion Certificate: Completed Contract Value INR 215.0 Crores for STRR Highway Project';

    const extractor = new AiEvidenceExtractor();
    const result = extractor.extractEvidenceLocal(doc, bufferText);

    expect(result.status).toBe('COMPLETED');
    expect(result.extracted_attributes.client_name).toBe('NHAI');
    expect(result.extracted_attributes.contract_value_inr_cr).toBe(215.0);
    expect(result.chunks[0]?.chunk_type).toBe('PROJECT_EXPERIENCE');
  });

  it('should extract ISO certification locally for accreditation documents', async () => {
    const doc: CompanyEvidenceDocument = {
      ...dummyDoc,
      fileName: 'ISO_9001_BV.pdf',
      evidenceType: 'ISO_CERT',
    };
    const bufferText = 'Bureau Veritas ISO 9001:2015 Quality Management System Certification';

    const extractor = new AiEvidenceExtractor();
    const result = extractor.extractEvidenceLocal(doc, bufferText);

    expect(result.status).toBe('COMPLETED');
    expect(result.extracted_attributes.standard).toBe('ISO 9001:2015');
    expect(result.extracted_attributes.issuer).toBe('Bureau Veritas');
    expect(result.chunks[0]?.chunk_type).toBe('CERTIFICATION');
  });
});
