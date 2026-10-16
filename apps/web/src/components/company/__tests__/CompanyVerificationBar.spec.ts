import { describe, it, expect } from 'vitest';
import React from 'react';
import { CompanyVerificationBar } from '@/components/company/CompanyVerificationBar.js';
import type { CompanyItem } from '@/api/companies.js';

describe('CompanyVerificationBar Component', () => {
  const mockCompany: CompanyItem = {
    id: 'comp-ashoka-123',
    organizationId: 'org-test',
    legalName: 'Ashoka Buildcon Ltd',
    gstin: '27AAACA1234F1Z5',
    pan: 'AAACA1234F',
    cin: 'L45200MH1993PLC071970',
    udyamId: 'UDYAM-MH-01-0099887',
    primaryAddress: 'Nashik, Maharashtra',
    operationalAddress: 'Nashik, Maharashtra',
    state: 'Maharashtra',
    stateJurisdiction: 'Maharashtra',
    gstinVerifiedAt: '2026-10-15T10:00:00.000Z',
    mcaVerifiedAt: '2026-10-15T10:05:00.000Z',
    udyamVerifiedAt: '2026-10-15T10:10:00.000Z',
    digilockerLinkedAt: '2026-10-15T10:15:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-10-15T10:15:00.000Z',
  };

  it('instantiates CompanyVerificationBar cleanly with verified company entity', () => {
    const el = React.createElement(CompanyVerificationBar, {
      company: mockCompany,
      onRefresh: () => {},
    });
    expect(el).toBeDefined();
    expect(el.props.company.legalName).toBe('Ashoka Buildcon Ltd');
  });

  it('instantiates with openEvidenceModalTrigger and defaultEvidenceSource set to DEVICE', () => {
    const el = React.createElement(CompanyVerificationBar, {
      company: mockCompany,
      onRefresh: () => {},
      openEvidenceModalTrigger: 12345678,
      defaultEvidenceSource: 'DEVICE',
    });
    expect(el).toBeDefined();
    expect(el.props.defaultEvidenceSource).toBe('DEVICE');
    expect(el.props.openEvidenceModalTrigger).toBe(12345678);
  });

  it('instantiates with defaultEvidenceSource set to GOOGLE_DRIVE', () => {
    const el = React.createElement(CompanyVerificationBar, {
      company: mockCompany,
      onRefresh: () => {},
      openEvidenceModalTrigger: 87654321,
      defaultEvidenceSource: 'GOOGLE_DRIVE',
    });
    expect(el).toBeDefined();
    expect(el.props.defaultEvidenceSource).toBe('GOOGLE_DRIVE');
  });
});
