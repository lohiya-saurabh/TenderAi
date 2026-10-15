/**
 * IrisIrpGstAdapter — Production infrastructure adapter for IRIS IRP / GSP API.
 *
 * Calls official IRIS IRP Taxpayer Search & Verification API endpoints.
 * Handles authentication headers, timeout protection, error mapping, and sanitization.
 */
import { Injectable, Logger } from '@nestjs/common';
import type {
  IGstVerificationPort,
  GstTaxpayerDetails,
} from '@/modules/company-verification/domain/ports/IGstVerificationPort.js';
import {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from '@/common/errors/errors.js';

interface IrisTaxpayerResponse {
  gstin?: string;
  lgnm?: string; // Legal name
  tradeNam?: string; // Trade name
  sts?: string; // Status: 'Active', 'Cancelled', 'Suspended'
  ctb?: string; // Constitution of business
  rgdt?: string; // Registration date
  dty?: string; // Taxpayer type
  pradr?: {
    addr?: {
      bno?: string;
      bnm?: string;
      st?: string;
      loc?: string;
      dst?: string;
      city?: string;
      stcd?: string;
      pncd?: string;
    };
  };
  adadr?: Array<{
    addr?: {
      city?: string;
      stcd?: string;
    };
  }>;
  status_cd?: string;
  error?: {
    error_cd?: string;
    message?: string;
  };
}

@Injectable()
export class IrisIrpGstAdapter implements IGstVerificationPort {
  private readonly logger = new Logger(IrisIrpGstAdapter.name);
  private readonly baseUrl: string;
  private readonly clientId?: string;
  private readonly clientSecret?: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor() {
    this.baseUrl = (process.env.IRIS_IRP_BASE_URL || 'https://api.irisirp.com').replace(/\/$/, '');
    this.clientId = process.env.IRIS_CLIENT_ID;
    this.clientSecret = process.env.IRIS_CLIENT_SECRET;
    this.apiKey = process.env.IRIS_API_KEY;
    this.timeoutMs = parseInt(process.env.IRIS_TIMEOUT_MS || '10000', 10);
  }

  public async verifyGstin(gstin: string): Promise<GstTaxpayerDetails> {
    const normalized = gstin.trim().toUpperCase();
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    if (!gstinRegex.test(normalized)) {
      throw new BadRequestError(`Invalid GSTIN format '${gstin}'. Expected 15 characters.`);
    }

    const endpoint = `${this.baseUrl}/gst/v1/taxpayer/${normalized}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };

      if (this.clientId) headers['client-id'] = this.clientId;
      if (this.clientSecret) headers['client-secret'] = this.clientSecret;
      if (this.apiKey) headers['apikey'] = this.apiKey;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 404) {
        throw new NotFoundError(`GSTIN '${normalized}' not found on GST Network.`);
      }

      if (response.status === 400) {
        const errJson = (await response.json().catch(() => ({}))) as IrisTaxpayerResponse;
        throw new BadRequestError(
          errJson.error?.message || `Invalid GSTIN request for '${normalized}'.`,
        );
      }

      if (!response.ok) {
        throw new InternalServerError(
          `IRIS IRP gateway returned status ${response.status} for GSTIN verification.`,
        );
      }

      const body = (await response.json()) as IrisTaxpayerResponse;

      if (body.error && body.error.message) {
        throw new BadRequestError(`IRIS IRP error: ${body.error.message}`);
      }

      return this.mapIrisResponse(normalized, body);
    } catch (err: unknown) {
      clearTimeout(timer);
      if (
        err instanceof BadRequestError ||
        err instanceof NotFoundError ||
        err instanceof InternalServerError
      ) {
        throw err;
      }

      if (err instanceof Error && err.name === 'AbortError') {
        throw new InternalServerError(`IRIS IRP request timed out after ${this.timeoutMs}ms.`);
      }

      this.logger.error(
        `Failed to connect to IRIS IRP: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new InternalServerError('Unable to reach IRIS IRP verification service.');
    }
  }

  private mapIrisResponse(gstin: string, body: IrisTaxpayerResponse): GstTaxpayerDetails {
    const addr = body.pradr?.addr;
    const legalName = body.lgnm || body.tradeNam || 'UNKNOWN ENTITY';

    const rawStatus = (body.sts || 'ACTIVE').toUpperCase();
    let status: 'ACTIVE' | 'CANCELLED' | 'SUSPENDED' | 'INACTIVE' = 'ACTIVE';
    if (rawStatus.includes('CANCEL')) status = 'CANCELLED';
    else if (rawStatus.includes('SUSPEND')) status = 'SUSPENDED';
    else if (rawStatus.includes('INACTIVE')) status = 'INACTIVE';

    const city = addr?.city || addr?.dst || addr?.loc || 'Unknown City';
    const state = addr?.stcd || 'Unknown State';
    const pincode = addr?.pncd || '';

    const additionalPlaces: string[] = [];
    if (body.adadr && Array.isArray(body.adadr)) {
      body.adadr.forEach((item) => {
        if (item.addr?.city) additionalPlaces.push(item.addr.city);
      });
    }

    return {
      gstin,
      legalName,
      tradeName: body.tradeNam,
      status,
      constitution: body.ctb || 'Private Limited Company',
      pan: gstin.substring(2, 12),
      dateOfRegistration: body.rgdt || new Date().toISOString().split('T')[0]!,
      principalAddress: {
        buildingName: addr?.bnm || addr?.bno,
        street: addr?.st,
        city,
        state,
        pincode,
      },
      additionalPlacesOfBusiness: additionalPlaces,
      taxpayerType: body.dty || 'Regular',
      rawResponse: body as Record<string, unknown>,
    };
  }
}
