/**
 * IMsmeVerificationPort — Domain port interface for MSME Udyam registration verification.
 *
 * Implements cloud/vendor agnostic architecture per AGENTS.md.
 * Allows TenderPulse AI to determine enterprise classification (Micro, Small, Medium)
 * for statutory procurement benefits (EMD exemptions, tender fee waivers).
 */

export type MsmeClassification = 'MICRO' | 'SMALL' | 'MEDIUM';
export type MsmeMajorActivity = 'MANUFACTURING' | 'SERVICES';

export interface NicCodeItem {
  code: string;
  description: string;
}

export interface MsmeEnterpriseDetails {
  udyamRegistrationNumber: string;
  enterpriseName: string;
  majorActivity: MsmeMajorActivity;
  enterpriseClassification: MsmeClassification;
  nicCodes: NicCodeItem[];
  dateOfIncorporation?: string;
  dateOfCommencement?: string;
  registeredState: string;
  units: string[];
  organizationType?: string;
  rawResponse?: Record<string, unknown>;
}

export const MSME_VERIFICATION_PORT = Symbol('IMsmeVerificationPort');

export interface IMsmeVerificationPort {
  /**
   * Validates and fetches enterprise details for a given Udyam registration number.
   * Throws BadRequestError if Udyam format is invalid, or NotFoundError if registration not found.
   */
  verifyUdyam(udyamNumber: string): Promise<MsmeEnterpriseDetails>;
}
