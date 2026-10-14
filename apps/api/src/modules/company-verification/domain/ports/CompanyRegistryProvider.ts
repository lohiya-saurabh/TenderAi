/**
 * CompanyRegistryProvider — Domain port interface for Ministry of Corporate Affairs (MCA) master data.
 *
 * Validates legal entity identity via Corporate Identification Number (CIN) or LLPIN.
 * Used to cross-check legal name, incorporation date, ROC jurisdiction, and active status.
 */

export interface McaCompanyMasterDetails {
  cinOrLlpin: string;
  companyName: string;
  rocOffice: string; // e.g. "RoC-Mumbai", "RoC-Delhi"
  registrationNumber: string;
  companyCategory: string; // "Company limited by shares"
  companySubCategory: string; // "Non-government company"
  classOfCompany: 'Private' | 'Public' | 'LLP';
  dateOfIncorporation: string;
  authorizedCapitalInr?: number;
  paidUpCapitalInr?: number;
  status: 'ACTIVE' | 'DORMANT' | 'UNDER_LIQUIDATION' | 'STRUCK_OFF';
  registeredAddress: string;
  directorsOrPartners?: Array<{ din: string; name: string }>;
  rawResponse?: Record<string, unknown>;
}

export const COMPANY_REGISTRY_PROVIDER = Symbol('CompanyRegistryProvider');

export interface CompanyRegistryProvider {
  /**
   * Retrieves official company master data for a given CIN or LLPIN.
   */
  verifyCin(cinOrLlpin: string): Promise<McaCompanyMasterDetails>;
}
