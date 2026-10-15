/**
 * MockGstVerificationAdapter — In-memory mock adapter for GSTIN verification.
 *
 * Provides deterministic verification without external network dependency or paid API credits.
 * Validates 15-character GSTIN regex, derives PAN, and returns realistic enterprise data.
 */
import { Injectable } from '@nestjs/common';
import type {
  IGstVerificationPort,
  GstTaxpayerDetails,
} from '@/modules/company-verification/domain/ports/IGstVerificationPort.js';
import { BadRequestError, NotFoundError } from '@/common/errors/errors.js';

const STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '19': 'West Bengal',
  '24': 'Gujarat',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '33': 'Tamil Nadu',
  '36': 'Telangana',
};

const KNOWN_GST_DATABASE: Record<string, Partial<GstTaxpayerDetails>> = {
  '27AABCU9603R1ZM': {
    legalName: 'ACME INFRASTRUCTURE INDIA PRIVATE LIMITED',
    tradeName: 'ACME INFRA',
    status: 'ACTIVE',
    constitution: 'Private Limited Company',
    dateOfRegistration: '2017-07-01',
    principalAddress: {
      buildingName: 'BKC Heights, 4th Floor',
      street: 'Bandra-Kurla Complex',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400051',
    },
    additionalPlacesOfBusiness: ['Pune', 'Nagpur'],
    taxpayerType: 'Regular',
  },
  '07AABCL1234D1ZP': {
    legalName: 'LARSEN & TOUBRO INFRASTRUCTURE PROJECTS LTD',
    tradeName: 'L&T INFRA',
    status: 'ACTIVE',
    constitution: 'Public Limited Company',
    dateOfRegistration: '2017-07-01',
    principalAddress: {
      buildingName: 'L&T House, Connaught Place',
      street: 'Barakhamba Road',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110001',
    },
    taxpayerType: 'Regular',
  },
};

@Injectable()
export class MockGstVerificationAdapter implements IGstVerificationPort {
  private readonly gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

  public async verifyGstin(gstin: string): Promise<GstTaxpayerDetails> {
    const normalized = gstin.trim().toUpperCase();

    if (!this.gstinRegex.test(normalized)) {
      throw new BadRequestError(
        `Invalid GSTIN format '${gstin}'. Expected 15-character alphanumeric format (e.g. 27AABCU9603R1ZM).`,
      );
    }

    // Explicit simulation of cancelled GSTIN for testing error resilience
    if (normalized.endsWith('999') || normalized.startsWith('99')) {
      throw new NotFoundError(
        `GSTIN '${gstin}' not found or has been cancelled on the GST Network.`,
      );
    }

    // Check predefined known mock entities
    const known = KNOWN_GST_DATABASE[normalized];
    if (known) {
      return {
        gstin: normalized,
        legalName: known.legalName!,
        tradeName: known.tradeName,
        status: known.status ?? 'ACTIVE',
        constitution: known.constitution ?? 'Private Limited Company',
        pan: normalized.substring(2, 12),
        dateOfRegistration: known.dateOfRegistration ?? '2018-04-01',
        principalAddress: known.principalAddress ?? {
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001',
        },
        additionalPlacesOfBusiness: known.additionalPlacesOfBusiness ?? [],
        taxpayerType: known.taxpayerType ?? 'Regular',
        rawResponse: { source: 'MOCK_GSTIN_ADAPTER', verified: true },
      };
    }

    // Dynamically derive realistic response for any valid GSTIN format
    const stateCode = normalized.substring(0, 2);
    const pan = normalized.substring(2, 12);
    const stateName = STATE_CODE_MAP[stateCode] || 'Maharashtra';

    return {
      gstin: normalized,
      legalName: `${pan} SOLUTIONS PRIVATE LIMITED`,
      tradeName: `${pan} GROUP`,
      status: 'ACTIVE',
      constitution: 'Private Limited Company',
      pan,
      dateOfRegistration: '2019-06-15',
      principalAddress: {
        buildingName: 'Tower 1, Corporate Park',
        street: 'Central Business District',
        city: stateName === 'Delhi' ? 'New Delhi' : 'Mumbai',
        state: stateName,
        pincode: stateCode === '07' ? '110001' : '400001',
      },
      additionalPlacesOfBusiness: [],
      taxpayerType: 'Regular',
      rawResponse: { source: 'MOCK_GSTIN_ADAPTER', dynamicDerived: true },
    };
  }
}
