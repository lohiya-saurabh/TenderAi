/**
 * MockMsmeVerificationAdapter — In-memory mock adapter for MSME Udyam verification.
 *
 * Provides deterministic enterprise classification without external network calls.
 * Validates Udyam registration format and returns realistic Micro/Small/Medium details.
 */
import { Injectable } from '@nestjs/common';
import type {
  IMsmeVerificationPort,
  MsmeEnterpriseDetails,
  MsmeClassification,
  MsmeMajorActivity,
} from '@/modules/company-verification/domain/ports/IMsmeVerificationPort.js';
import { BadRequestError, NotFoundError } from '@/common/errors/errors.js';

const KNOWN_UDYAM_DATABASE: Record<string, Partial<MsmeEnterpriseDetails>> = {
  'UDYAM-MH-01-0012345': {
    enterpriseName: 'ACME INFRASTRUCTURE INDIA PVT LTD',
    majorActivity: 'SERVICES',
    enterpriseClassification: 'SMALL',
    registeredState: 'Maharashtra',
    nicCodes: [
      {
        code: '42101',
        description:
          'Construction of motorways, streets, roads, other vehicular and pedestrian ways',
      },
      {
        code: '42201',
        description: 'Construction of water and sewage mains, pipe lines and treatment plants',
      },
    ],
    dateOfIncorporation: '2018-03-12',
    dateOfCommencement: '2018-04-01',
    units: ['Unit 1 - BKC Mumbai', 'Unit 2 - Chakan Pune'],
    organizationType: 'Private Limited Company',
  },
  'UDYAM-DL-02-0098765': {
    enterpriseName: 'NORTHERN SMART CITY SOLUTIONS LLP',
    majorActivity: 'SERVICES',
    enterpriseClassification: 'MEDIUM',
    registeredState: 'Delhi',
    nicCodes: [
      {
        code: '62020',
        description: 'Computer consultancy and computer facilities management activities',
      },
    ],
    dateOfIncorporation: '2020-01-10',
    dateOfCommencement: '2020-02-01',
    units: ['Okhla Industrial Area Phase-III'],
    organizationType: 'Limited Liability Partnership',
  },
  'UDYAM-KA-03-0054321': {
    enterpriseName: 'DECCAN PRECAST SYSTEMS',
    majorActivity: 'MANUFACTURING',
    enterpriseClassification: 'MICRO',
    registeredState: 'Karnataka',
    nicCodes: [
      {
        code: '23951',
        description:
          'Manufacture of precast concrete, cement or artificial stone articles for use in construction',
      },
    ],
    dateOfIncorporation: '2021-08-20',
    dateOfCommencement: '2021-09-01',
    units: ['Peenya Industrial Area Bangalore'],
    organizationType: 'Proprietorship',
  },
};

@Injectable()
export class MockMsmeVerificationAdapter implements IMsmeVerificationPort {
  private readonly udyamRegex = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;

  public async verifyUdyam(udyamNumber: string): Promise<MsmeEnterpriseDetails> {
    const normalized = udyamNumber.trim().toUpperCase();

    if (!this.udyamRegex.test(normalized)) {
      throw new BadRequestError(
        `Invalid Udyam registration format '${udyamNumber}'. Expected format: UDYAM-XX-00-0000000 (e.g. UDYAM-MH-01-0012345).`,
      );
    }

    if (normalized.endsWith('9999999')) {
      throw new NotFoundError(`Udyam registration '${udyamNumber}' not found or has been revoked.`);
    }

    const known = KNOWN_UDYAM_DATABASE[normalized];
    if (known) {
      return {
        udyamRegistrationNumber: normalized,
        enterpriseName: known.enterpriseName!,
        majorActivity: known.majorActivity ?? 'SERVICES',
        enterpriseClassification: known.enterpriseClassification ?? 'SMALL',
        nicCodes: known.nicCodes ?? [],
        dateOfIncorporation: known.dateOfIncorporation ?? '2018-01-01',
        dateOfCommencement: known.dateOfCommencement ?? '2018-02-01',
        registeredState: known.registeredState ?? 'Maharashtra',
        units: known.units ?? ['Unit 1'],
        organizationType: known.organizationType ?? 'Private Limited Company',
        rawResponse: { source: 'MOCK_UDYAM_ADAPTER', verified: true },
      };
    }

    // Dynamic derivation from digits
    const stateCode = normalized.split('-')[1] || 'MH';
    const lastDigits = parseInt(normalized.slice(-4), 10) || 1234;

    let classification: MsmeClassification = 'SMALL';
    if (lastDigits % 3 === 0) classification = 'MICRO';
    else if (lastDigits % 3 === 1) classification = 'MEDIUM';

    const majorActivity: MsmeMajorActivity = lastDigits % 2 === 0 ? 'SERVICES' : 'MANUFACTURING';

    return {
      udyamRegistrationNumber: normalized,
      enterpriseName: `ENTERPRISE ${normalized.replace(/-/g, ' ')}`,
      majorActivity,
      enterpriseClassification: classification,
      nicCodes: [
        { code: '42101', description: 'General civil engineering & infrastructure services' },
      ],
      dateOfIncorporation: '2019-05-10',
      dateOfCommencement: '2019-06-01',
      registeredState:
        stateCode === 'DL' ? 'Delhi' : stateCode === 'KA' ? 'Karnataka' : 'Maharashtra',
      units: [`Main Plant - ${stateCode}`],
      organizationType: 'Private Limited Company',
      rawResponse: { source: 'MOCK_UDYAM_ADAPTER', dynamicDerived: true },
    };
  }
}
