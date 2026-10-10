/**
 * IGstVerificationPort — Domain port interface for GSTIN verification & taxpayer data retrieval.
 *
 * Implements cloud/vendor agnostic architecture per AGENTS.md.
 * Application logic relies on this port without any coupling to IRIS IRP or third-party providers.
 */

export interface GstTaxpayerAddress {
  buildingName?: string;
  street?: string;
  city: string;
  state: string;
  pincode: string;
}

export interface GstTaxpayerDetails {
  gstin: string;
  legalName: string;
  tradeName?: string;
  status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'INACTIVE';
  constitution: string; // e.g. "Private Limited Company", "Partnership", "Proprietorship", "Public Limited Company"
  pan: string;
  dateOfRegistration: string;
  principalAddress: GstTaxpayerAddress;
  additionalPlacesOfBusiness?: string[];
  taxpayerType?: string; // 'Regular', 'Composition', etc.
  rawResponse?: Record<string, unknown>;
}

export const GST_VERIFICATION_PORT = Symbol('IGstVerificationPort');

export interface IGstVerificationPort {
  /**
   * Validates and fetches legal taxpayer information for a given GSTIN.
   * Throws BadRequestError if GSTIN format is invalid, or NotFoundError if taxpayer not found.
   */
  verifyGstin(gstin: string): Promise<GstTaxpayerDetails>;
}
