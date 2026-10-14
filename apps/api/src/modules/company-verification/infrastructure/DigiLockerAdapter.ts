/**
 * DigiLockerAdapter — Production infrastructure adapter for DigiLocker OAuth2 & Document Depository.
 *
 * Implements government OAuth2 authorization handshake and pulls issued certificates
 * (MCA, GSTN, MSME, Income Tax) directly via DigiLocker REST APIs.
 */
import { Injectable, Logger } from '@nestjs/common';
import crypto from 'node:crypto';
import type {
  IDigitalLockerPort,
  DigiLockerAuthRequest,
  DigiLockerTokenResponse,
  DigiLockerIssuedDocument,
} from '../domain/ports/IDigitalLockerPort.js';
import { BadRequestError, InternalServerError } from '../../../common/errors/errors.js';

interface RawDigiLockerTokenPayload {
  access_token?: string;
  digilockerid?: string;
  name?: string;
  dob?: string;
  gender?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface RawIssuedFileListResponse {
  items?: Array<{
    name?: string;
    type?: string;
    size?: string;
    date?: string;
    uri?: string;
    doctype?: string;
    description?: string;
    issuer?: string;
  }>;
}

@Injectable()
export class DigiLockerAdapter implements IDigitalLockerPort {
  private readonly logger = new Logger(DigiLockerAdapter.name);
  private readonly authUrl: string;
  private readonly tokenUrl: string;
  private readonly apiUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly hmacSecret: string;
  private readonly timeoutMs: number;

  constructor() {
    this.authUrl =
      process.env.DIGILOCKER_AUTH_URL ||
      'https://digilocker.meripehchan.gov.in/public/oauth2/1/authorize';
    this.tokenUrl =
      process.env.DIGILOCKER_TOKEN_URL ||
      'https://digilocker.meripehchan.gov.in/public/oauth2/1/token';
    this.apiUrl =
      process.env.DIGILOCKER_API_URL || 'https://digilocker.meripehchan.gov.in/public/oauth2/1';
    this.clientId = process.env.DIGILOCKER_CLIENT_ID || 'tenderpulse_production_client';
    this.clientSecret = process.env.DIGILOCKER_CLIENT_SECRET || 'tenderpulse_production_secret';
    this.hmacSecret = process.env.DIGILOCKER_STATE_SECRET || 'tenderpulse-state-secret';
    this.timeoutMs = parseInt(process.env.DIGILOCKER_TIMEOUT_MS || '15000', 10);
  }

  public async generateAuthUrl(
    tenantId: string,
    companyId: string,
    redirectUri: string,
  ): Promise<DigiLockerAuthRequest> {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    const payload = `${tenantId}:${companyId}:${nonce}:${timestamp}`;
    const hmac = crypto.createHmac('sha256', this.hmacSecret).update(payload).digest('hex');
    const state = Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUri,
      state,
      scope: 'org_docs',
    });

    return {
      authorizationUrl: `${this.authUrl}?${params.toString()}`,
      state,
    };
  }

  public async exchangeCodeForToken(
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<DigiLockerTokenResponse> {
    // 1. Verify state signature to prevent CSRF / session fixation
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
        payload: string;
        hmac: string;
      };
      const expectedHmac = crypto
        .createHmac('sha256', this.hmacSecret)
        .update(decoded.payload)
        .digest('hex');
      if (expectedHmac !== decoded.hmac) {
        throw new BadRequestError('Invalid DigiLocker state token (HMAC mismatch).');
      }

      const [, , , timestampStr] = decoded.payload.split(':');
      const timestamp = parseInt(timestampStr || '0', 10);
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        throw new BadRequestError('DigiLocker authorization expired. Please restart consent flow.');
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestError) throw err;
      throw new BadRequestError('Malformed DigiLocker state token.');
    }

    // 2. Call DigiLocker Token Exchange Endpoint
    const bodyParams = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      redirect_uri: redirectUri,
    });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(this.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: bodyParams.toString(),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`DigiLocker token exchange failed (${response.status}): ${errorText}`);
        throw new BadRequestError('Failed to exchange authorization code with DigiLocker.');
      }

      const data = (await response.json()) as RawDigiLockerTokenPayload;
      if (!data.access_token) {
        throw new BadRequestError(
          data.error_description || 'DigiLocker did not return an access token.',
        );
      }

      return {
        accessToken: data.access_token,
        digiLockerId: data.digilockerid || 'unknown_dl_id',
        name: data.name || 'Enterprise Signatory',
        dob: data.dob,
        gender: data.gender,
        expiresInSeconds: data.expires_in || 3600,
      };
    } catch (err: unknown) {
      clearTimeout(timer);
      if (err instanceof BadRequestError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw new InternalServerError('DigiLocker token exchange timed out.');
      }
      throw new InternalServerError('Error connecting to DigiLocker authentication service.');
    }
  }

  public async fetchIssuedDocuments(accessToken: string): Promise<DigiLockerIssuedDocument[]> {
    const listEndpoint = `${this.apiUrl}/files/issued`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const listResponse = await fetch(listEndpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!listResponse.ok) {
        throw new InternalServerError(
          `Failed to fetch issued documents list (${listResponse.status}).`,
        );
      }

      const listData = (await listResponse.json()) as RawIssuedFileListResponse;
      const items = listData.items || [];
      const documents: DigiLockerIssuedDocument[] = [];

      for (const item of items) {
        if (!item.uri) continue;
        const fileDoc = await this.downloadFileByUri(
          item.uri,
          accessToken,
          item.name || 'document.pdf',
        );
        if (fileDoc) {
          documents.push(fileDoc);
        }
      }

      return documents;
    } catch (err: unknown) {
      clearTimeout(timer);
      this.logger.error(
        `Error pulling documents from DigiLocker: ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new InternalServerError('Failed to fetch issued files from DigiLocker repository.');
    }
  }

  private async downloadFileByUri(
    uri: string,
    accessToken: string,
    defaultName: string,
  ): Promise<DigiLockerIssuedDocument | null> {
    try {
      const pullEndpoint = `${this.apiUrl}/file/${encodeURIComponent(uri)}`;
      const response = await fetch(pullEndpoint, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) return null;

      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');

      let docType: DigiLockerIssuedDocument['docType'] = 'OTHER';
      const upper = (uri + ' ' + defaultName).toUpperCase();
      if (upper.includes('INC') || upper.includes('CORP') || upper.includes('MCA')) {
        docType = 'INCORPORATION_CERTIFICATE';
      } else if (upper.includes('GST') || upper.includes('REG-06')) {
        docType = 'GST_CERTIFICATE';
      } else if (upper.includes('UDYAM') || upper.includes('MSME')) {
        docType = 'UDYAM_CERTIFICATE';
      } else if (upper.includes('PAN')) {
        docType = 'PAN_CARD';
      }

      return {
        docType,
        docName: defaultName.endsWith('.pdf') ? defaultName : `${defaultName}.pdf`,
        uri,
        mimeType: 'application/pdf',
        issuer: 'Government of India Digital Depository',
        fileBuffer: buffer,
        sha256Hash,
      };
    } catch {
      return null;
    }
  }
}
