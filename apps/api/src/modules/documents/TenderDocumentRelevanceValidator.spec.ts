import { describe, it, expect } from 'vitest';
import { TenderDocumentRelevanceValidator } from './TenderDocumentRelevanceValidator.js';

describe('TenderDocumentRelevanceValidator — Pre-Ingestion Integrity Verification', () => {
  const validator = new TenderDocumentRelevanceValidator();

  const targetTender = {
    id: 'bid-cpwd-gov-002',
    title: 'Construction of Sustainable Central Government Administrative Complex (Phase 2)',
    tenderNumber: 'CPWD/DELHI/2026/CIVIL-0491',
    tenderingAuthority: 'Central Public Works Department (CPWD)',
    locationState: 'Delhi',
    estimatedValueRupees: 1850000000,
  };

  it('accepts document matching explicit tender reference number', async () => {
    const content = Buffer.from(
      'NOTICE INVITING TENDER\nTender Ref No: CPWD/DELHI/2026/CIVIL-0491\n' +
        'Bids are invited from eligible contractors for the works.',
      'utf-8',
    );

    const result = await validator.validate({
      documentId: 'doc-1',
      fileName: 'Volume_I_NIT.pdf',
      content,
      tender: targetTender,
    });

    expect(result.isRelevant).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(45);
    expect(result.matchedSignals.some((s) => s.includes('tender reference number'))).toBe(true);
  });

  it('accepts document matching tendering authority and key project title terms', async () => {
    const content = Buffer.from(
      'CENTRAL PUBLIC WORKS DEPARTMENT\n' +
        'GENERAL CONDITIONS OF CONTRACT\n' +
        'Sustainable Administrative Complex Construction Project in Delhi\n' +
        'Section 1: Instructions to Bidders.',
      'utf-8',
    );

    const result = await validator.validate({
      documentId: 'doc-2',
      fileName: 'GCC_Administrative_Complex.pdf',
      content,
      tender: targetTender,
    });

    expect(result.isRelevant).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(50);
  });

  it('rejects clearly unrelated document (e.g. recipe or random receipt)', async () => {
    const content = Buffer.from(
      'CHOCOLATE CHIP COOKIE RECIPE\n' +
        'Ingredients: 2 cups flour, 1 cup butter, 1 cup brown sugar, chocolate chips.\n' +
        'Instructions: Preheat oven to 350 degrees F. Bake for 10-12 minutes until golden brown.',
      'utf-8',
    );

    const result = await validator.validate({
      documentId: 'doc-unrelated-1',
      fileName: 'cookie_recipe.txt',
      content,
      tender: targetTender,
    });

    expect(result.isRelevant).toBe(false);
    expect(result.score).toBeLessThan(30);
    expect(result.rejectionReason).toContain('does not appear to belong to tender');
    expect(result.rejectionReason).toContain('CPWD/DELHI/2026/CIVIL-0491');
  });

  it('rejects document belonging to a completely different authority and tender', async () => {
    const content = Buffer.from(
      'MUNICIPAL CORPORATION OF GREATER MUMBAI (MCGM)\n' +
        'Tender ID: MCGM/WATER/2025/PIPE-9871\n' +
        'Replacement of Water Distribution Pipelines in Bandra West, Mumbai, Maharashtra.',
      'utf-8',
    );

    const result = await validator.validate({
      documentId: 'doc-mumbai-water',
      fileName: 'MCGM_Water_Pipeline_NIT.pdf',
      content,
      tender: targetTender,
    });

    expect(result.isRelevant).toBe(false);
    expect(result.rejectionReason).toContain('does not appear to belong to tender');
  });

  it('does not hardcode specific tenders and accurately validates another arbitrary tender', async () => {
    const smartCityTender = {
      id: 'bid-mha-surv-003',
      title: 'City-Wide Integrated CCTV Surveillance & Traffic Command Centre (ICCC)',
      tenderNumber: 'MHA/SMARTCITY/2026/ITS-0118',
      tenderingAuthority: 'Smart Cities Mission & Municipal Corporation',
      locationState: 'Karnataka',
    };

    const validContent = Buffer.from(
      'REQUEST FOR PROPOSAL (RFP)\n' +
        'RFP No: MHA/SMARTCITY/2026/ITS-0118\n' +
        'City-Wide Integrated CCTV Surveillance Project, Karnataka.',
      'utf-8',
    );

    const validResult = await validator.validate({
      documentId: 'doc-iccc-rfp',
      fileName: 'ICCC_Surveillance_RFP.pdf',
      content: validContent,
      tender: smartCityTender,
    });

    expect(validResult.isRelevant).toBe(true);

    const invalidContent = Buffer.from(
      'NATIONAL HIGHWAYS AUTHORITY OF INDIA (NHAI)\n' +
        'Four-laning of NH-62 section from km 100 to km 250 in Rajasthan.',
      'utf-8',
    );

    const invalidResult = await validator.validate({
      documentId: 'doc-nhai-highway',
      fileName: 'NHAI_Highway_Agreement.pdf',
      content: invalidContent,
      tender: smartCityTender,
    });

    expect(invalidResult.isRelevant).toBe(false);
  });
});
