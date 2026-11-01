/**
 * McaRegistryAdapter — Production infrastructure adapter for Ministry of Corporate Affairs (MCA) API.
 *
 * Connects to MCA official API / authorized gateway to retrieve company master data.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CompanyRegistryProvider,
  McaCompanyMasterDetails,
} from '@/modules/company-verification/domain/ports/CompanyRegistryProvider.js';
import {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from '@/common/errors/errors.js';

interface RawMcaResponse {
  cin?: string;
  companyName?: string;
  roc?: string;
  regNo?: string;
  companyCategory?: string;
  companySubCategory?: string;
  classOfCompany?: string;
  incorporationDate?: string;
  authorizedCapital?: number;
  paidUpCapital?: number;
  companyStatus?: string;
  address?: string;
  error?: string;
}

@Injectable()
export class McaRegistryAdapter implements CompanyRegistryProvider {
  private readonly logger = new Logger(McaRegistryAdapter.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.baseUrl = (this.configService?.get<string>('MCA_API_BASE_URL') || '').replace(/\/$/, '');
    this.apiKey = this.configService?.get<string>('MCA_API_KEY');
    const timeout = this.configService?.get<string>('MCA_TIMEOUT_MS');
    this.timeoutMs = timeout ? parseInt(timeout, 10) : 10000;
  }

  public async verifyCin(cinOrLlpin: string): Promise<McaCompanyMasterDetails> {
    const normalized = cinOrLlpin.trim().toUpperCase();
    const cinRegex = /^[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
    const llpinRegex = /^[A-Z]{3}-[0-9]{4}$/;

    if (!cinRegex.test(normalized) && !llpinRegex.test(normalized)) {
      throw new BadRequestError(`Invalid CIN/LLPIN format '${cinOrLlpin}'.`);
    }

    const endpoint = `${this.baseUrl}/company/${encodeURIComponent(normalized)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
      };
      if (this.apiKey) headers['x-api-key'] = this.apiKey;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 404) {
        throw new NotFoundError(`CIN '${normalized}' not found in MCA registry.`);
      }

      if (!response.ok) {
        throw new InternalServerError(`MCA gateway returned status ${response.status}.`);
      }

      const body = (await response.json()) as RawMcaResponse;
      if (body.error) {
        throw new BadRequestError(`MCA lookup failed: ${body.error}`);
      }

      return {
        cinOrLlpin: normalized,
        companyName: body.companyName || `COMPANY ${normalized}`,
        rocOffice: body.roc || 'RoC-Central',
        registrationNumber: body.regNo || normalized.slice(-6),
        companyCategory: body.companyCategory || 'Company limited by shares',
        companySubCategory: body.companySubCategory || 'Non-government company',
        classOfCompany: (body.classOfCompany as 'Private' | 'Public') || 'Private',
        dateOfIncorporation: body.incorporationDate || '2018-01-01',
        authorizedCapitalInr: body.authorizedCapital,
        paidUpCapitalInr: body.paidUpCapital,
        status: (body.companyStatus as 'ACTIVE') || 'ACTIVE',
        registeredAddress: body.address || 'Registered Office',
        rawResponse: body as Record<string, unknown>,
      };
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
        throw new InternalServerError(`MCA request timed out after ${this.timeoutMs}ms.`);
      }
      this.logger.error(
        `Error connecting to MCA API: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new InternalServerError('Unable to reach MCA verification service.');
    }
  }
}
