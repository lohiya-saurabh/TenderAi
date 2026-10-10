/**
 * BusinessVerificationProvider — Domain port interface for tax & business registration verification.
 *
 * Implements provider-independent verification for GSTIN, PAN, and related tax identities.
 */
import type { GstTaxpayerDetails } from './IGstVerificationPort.js';

export interface BusinessVerificationProvider {
  /**
   * Validates and retrieves verified taxpayer details for a business identifier (GSTIN).
   */
  verifyGstin(gstin: string): Promise<GstTaxpayerDetails>;
}

export const BUSINESS_VERIFICATION_PROVIDER = Symbol('BusinessVerificationProvider');
export type { GstTaxpayerDetails, GstTaxpayerAddress } from './IGstVerificationPort.js';
