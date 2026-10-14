/**
 * MockMcaRegistryAdapter — In-memory mock adapter for MCA company master data.
 *
 * Validates 21-character CIN regex (or LLPIN), providing deterministic master data
 * for cross-checking legal entity name, incorporation date, and ROC jurisdiction.
 */
import { Injectable } from '@nestjs/common';
import type {
  CompanyRegistryProvider,
  McaCompanyMasterDetails,
} from '../domain/ports/CompanyRegistryProvider.js';
import { BadRequestError, NotFoundError } from '../../../common/errors/errors.js';

const KNOWN_MCA_DATABASE: Record<string, Partial<McaCompanyMasterDetails>> = {
  U72900MH2018PTC123456: {
    companyName: 'ACME INFRASTRUCTURE INDIA PRIVATE LIMITED',
    rocOffice: 'RoC-Mumbai',
    registrationNumber: '123456',
    companyCategory: 'Company limited by shares',
    companySubCategory: 'Non-government company',
    classOfCompany: 'Private',
    dateOfIncorporation: '2018-04-12',
    authorizedCapitalInr: 100000000, // ₹10 Crores
    paidUpCapitalInr: 75000000, // ₹7.5 Crores
    status: 'ACTIVE',
    registeredAddress: 'BKC Heights, 4th Floor, Bandra-Kurla Complex, Mumbai, Maharashtra 400051',
    directorsOrPartners: [
      { din: '01234567', name: 'Rajesh Sharma' },
      { din: '07654321', name: 'Ananya Verma' },
    ],
  },
  L45200MH1946PLC004768: {
    companyName: 'LARSEN & TOUBRO LIMITED',
    rocOffice: 'RoC-Mumbai',
    registrationNumber: '004768',
    companyCategory: 'Company limited by shares',
    companySubCategory: 'Non-government company',
    classOfCompany: 'Public',
    dateOfIncorporation: '1946-02-07',
    authorizedCapitalInr: 5000000000,
    paidUpCapitalInr: 2810000000,
    status: 'ACTIVE',
    registeredAddress: 'L&T House, Ballard Estate, Mumbai, Maharashtra 400001',
  },
};

@Injectable()
export class MockMcaRegistryAdapter implements CompanyRegistryProvider {
  private readonly cinRegex = /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
  private readonly llpinRegex = /^[A-Z]{3}-[0-9]{4}$/;

  public async verifyCin(cinOrLlpin: string): Promise<McaCompanyMasterDetails> {
    const normalized = cinOrLlpin.trim().toUpperCase();

    if (!this.cinRegex.test(normalized) && !this.llpinRegex.test(normalized)) {
      throw new BadRequestError(
        `Invalid CIN/LLPIN format '${cinOrLlpin}'. Expected 21-character Corporate Identity Number (e.g. U72900MH2018PTC123456).`,
      );
    }

    if (normalized.endsWith('999999')) {
      throw new NotFoundError(
        `Company with CIN '${cinOrLlpin}' not found in Ministry of Corporate Affairs registry.`,
      );
    }

    const known = KNOWN_MCA_DATABASE[normalized];
    if (known) {
      return {
        cinOrLlpin: normalized,
        companyName: known.companyName!,
        rocOffice: known.rocOffice ?? 'RoC-Mumbai',
        registrationNumber: known.registrationNumber ?? normalized.slice(-6),
        companyCategory: known.companyCategory ?? 'Company limited by shares',
        companySubCategory: known.companySubCategory ?? 'Non-government company',
        classOfCompany: known.classOfCompany ?? 'Private',
        dateOfIncorporation: known.dateOfIncorporation ?? '2018-01-01',
        authorizedCapitalInr: known.authorizedCapitalInr ?? 50000000,
        paidUpCapitalInr: known.paidUpCapitalInr ?? 25000000,
        status: known.status ?? 'ACTIVE',
        registeredAddress: known.registeredAddress ?? 'Corporate Park, Mumbai 400051',
        directorsOrPartners: known.directorsOrPartners ?? [],
        rawResponse: { source: 'MOCK_MCA_REGISTRY', verified: true },
      };
    }

    // Dynamic derivation for valid CINs
    const stateCode = normalized.substring(6, 8);
    const year = normalized.substring(8, 12);
    const type = normalized.substring(12, 15);

    return {
      cinOrLlpin: normalized,
      companyName: `ENTERPRISE ${normalized.slice(-6)} PRIVATE LIMITED`,
      rocOffice: `RoC-${stateCode}`,
      registrationNumber: normalized.slice(-6),
      companyCategory: 'Company limited by shares',
      companySubCategory: 'Non-government company',
      classOfCompany: type === 'PLC' ? 'Public' : 'Private',
      dateOfIncorporation: `${year}-04-01`,
      authorizedCapitalInr: 50000000,
      paidUpCapitalInr: 20000000,
      status: 'ACTIVE',
      registeredAddress: `Registered Office, Sector 5, State Code ${stateCode}`,
      directorsOrPartners: [{ din: '09999999', name: 'Managing Director' }],
      rawResponse: { source: 'MOCK_MCA_REGISTRY', dynamicDerived: true },
    };
  }
}
