/**
 * UdyamVerificationAdapter — Production infrastructure adapter for MSME Udyam API.
 *
 * Calls the official Udyam Registration Verification API.
 * Maps government portal payload into domain MsmeEnterpriseDetails with strict error handling.
 */
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IMsmeVerificationPort,
  MsmeEnterpriseDetails,
  MsmeClassification,
  MsmeMajorActivity,
} from '@/modules/company-verification/domain/ports/IMsmeVerificationPort.js';
import {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from '@/common/errors/errors.js';

interface RawUdyamResponse {
  udyamRegistrationNumber?: string;
  enterpriseName?: string;
  majorActivity?: string; // 'Manufacturing' or 'Services'
  enterpriseType?: string; // 'Micro', 'Small', 'Medium'
  nicCodes?: Array<{ code: string; desc: string }>;
  dateOfIncorporation?: string;
  dateOfCommencement?: string;
  state?: string;
  units?: string[];
  status?: string;
  error?: string;
}

@Injectable()
export class UdyamVerificationAdapter implements IMsmeVerificationPort {
  private readonly logger = new Logger(UdyamVerificationAdapter.name);
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly clientId?: string;
  private readonly timeoutMs: number;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.baseUrl = (
      this.configService?.get<string>('UDYAM_API_BASE_URL') || ''
    ).replace(/\/$/, '');
    this.apiKey = this.configService?.get<string>('UDYAM_API_KEY');
    this.clientId = this.configService?.get<string>('UDYAM_CLIENT_ID');
    const timeout = this.configService?.get<string>('UDYAM_TIMEOUT_MS');
    this.timeoutMs = timeout ? parseInt(timeout, 10) : 10000;
  }

  public async verifyUdyam(udyamNumber: string): Promise<MsmeEnterpriseDetails> {
    const normalized = udyamNumber.trim().toUpperCase();
    const regex = /^UDYAM-[A-Z]{2}-[0-9]{2}-[0-9]{7}$/;
    if (!regex.test(normalized)) {
      throw new BadRequestError(`Invalid Udyam registration format '${udyamNumber}'.`);
    }

    const endpoint = `${this.baseUrl}/verify/${encodeURIComponent(normalized)}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      };
      if (this.apiKey) headers['x-api-key'] = this.apiKey;
      if (this.clientId) headers['client-id'] = this.clientId;

      const response = await fetch(endpoint, {
        method: 'GET',
        headers,
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (response.status === 404) {
        throw new NotFoundError(`Udyam registration '${normalized}' not found.`);
      }

      if (!response.ok) {
        throw new InternalServerError(
          `Udyam verification gateway returned status ${response.status}.`,
        );
      }

      const body = (await response.json()) as RawUdyamResponse;
      if (body.error) {
        throw new BadRequestError(`Udyam verification failed: ${body.error}`);
      }

      return this.mapUdyamResponse(normalized, body);
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
        throw new InternalServerError(`Udyam API request timed out after ${this.timeoutMs}ms.`);
      }
      this.logger.error(
        `Failed to connect to Udyam service: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new InternalServerError('Unable to reach MSME Udyam verification service.');
    }
  }

  private mapUdyamResponse(udyamNumber: string, data: RawUdyamResponse): MsmeEnterpriseDetails {
    const rawType = (data.enterpriseType || 'SMALL').toUpperCase();
    let classification: MsmeClassification = 'SMALL';
    if (rawType.includes('MICRO')) classification = 'MICRO';
    else if (rawType.includes('MEDIUM')) classification = 'MEDIUM';

    const rawActivity = (data.majorActivity || 'SERVICES').toUpperCase();
    const majorActivity: MsmeMajorActivity = rawActivity.includes('MANUFACTURING')
      ? 'MANUFACTURING'
      : 'SERVICES';

    return {
      udyamRegistrationNumber: udyamNumber,
      enterpriseName: data.enterpriseName || `ENTERPRISE ${udyamNumber}`,
      majorActivity,
      enterpriseClassification: classification,
      nicCodes: (data.nicCodes || []).map((n) => ({ code: n.code, description: n.desc })),
      dateOfIncorporation: data.dateOfIncorporation,
      dateOfCommencement: data.dateOfCommencement,
      registeredState: data.state || 'India',
      units: data.units || [],
      rawResponse: data as Record<string, unknown>,
    };
  }
}
