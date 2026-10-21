/**
 * MockDigitalLockerAdapter — In-memory mock adapter for DigiLocker OAuth2 consent & document import.
 *
 * Simulates user consent redirect, HMAC-signed OAuth state parameter verification,
 * and retrieval of government-issued corporate certificates (MCA, GSTN, MSME)
 * with authentic PDF buffers and computed SHA-256 cryptographic hashes.
 */
import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import crypto from 'node:crypto';
import type {
  IDigitalLockerPort,
  DigiLockerAuthRequest,
  DigiLockerTokenResponse,
  DigiLockerIssuedDocument,
} from '@/modules/company-verification/domain/ports/IDigitalLockerPort.js';
import { BadRequestError } from '@/common/errors/errors.js';

@Injectable()
export class MockDigitalLockerAdapter implements IDigitalLockerPort {
  private readonly hmacSecret: string;

  constructor(@Optional() private readonly configService?: ConfigService) {
    this.hmacSecret = this.configService?.get<string>('DIGILOCKER_STATE_SECRET') ?? '';
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

    const authorizationUrl = `https://mock.digilocker.gov.in/oauth/authorize?response_type=code&client_id=mock_tenderpulse_client&redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${state}&scope=org_docs`;

    return {
      authorizationUrl,
      state,
    };
  }

  public async exchangeCodeForToken(
    code: string,
    state: string,
    _redirectUri: string,
  ): Promise<DigiLockerTokenResponse> {
    if (!code || code.trim().length === 0) {
      throw new BadRequestError('DigiLocker authorization code is required.');
    }

    // Verify state signature integrity
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
        throw new BadRequestError('Invalid or forged DigiLocker state token (HMAC mismatch).');
      }

      const [, , , timestampStr] = decoded.payload.split(':');
      const timestamp = parseInt(timestampStr || '0', 10);
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        throw new BadRequestError(
          'DigiLocker OAuth session expired. Please restart the authorization.',
        );
      }
    } catch (err: unknown) {
      if (err instanceof BadRequestError) throw err;
      throw new BadRequestError('Malformed DigiLocker state token.');
    }

    return {
      accessToken: `mock_dl_token_${crypto.randomBytes(24).toString('hex')}`,
      digiLockerId: `dl_${crypto.randomBytes(8).toString('hex')}`,
      name: 'Authorized Signatory / Enterprise Representative',
      expiresInSeconds: 3600,
    };
  }

  public async fetchIssuedDocuments(_accessToken: string): Promise<DigiLockerIssuedDocument[]> {
    const makePdf = (title: string, certNo: string) => {
      const content = `%PDF-1.4\n%Digital-Locker-Verified-Certificate\nTitle: ${title}\nCertificate Number: ${certNo}\nIssuer: Government of India Depository\nTimestamp: ${new Date().toISOString()}\n%%EOF`;
      const buffer = Buffer.from(content, 'utf-8');
      const sha256Hash = crypto.createHash('sha256').update(buffer).digest('hex');
      return { buffer, sha256Hash };
    };

    const incDoc = makePdf(
      'Ministry of Corporate Affairs - Certificate of Incorporation',
      'U72900MH2018PTC123456',
    );
    const gstDoc = makePdf(
      'GSTN - Goods & Services Tax Registration Certificate',
      '27AABCU9603R1ZM',
    );
    const udyamDoc = makePdf(
      'Ministry of MSME - Udyam Registration Certificate',
      'UDYAM-MH-01-0012345',
    );

    return [
      {
        docType: 'INCORPORATION_CERTIFICATE',
        docName: 'Certificate_of_Incorporation_MCA.pdf',
        uri: 'in.gov.mca.inc.corp.123456',
        mimeType: 'application/pdf',
        issuer: 'Ministry of Corporate Affairs (MCA)',
        issueDate: '2018-04-12',
        fileBuffer: incDoc.buffer,
        sha256Hash: incDoc.sha256Hash,
        metadata: { cin: 'U72900MH2018PTC123456', registrationType: 'Private Limited Company' },
      },
      {
        docType: 'GST_CERTIFICATE',
        docName: 'GST_Registration_Certificate_Form_REG-06.pdf',
        uri: 'in.gov.gstn.reg.27AABCU9603R1ZM',
        mimeType: 'application/pdf',
        issuer: 'Goods and Services Tax Network (GSTN)',
        issueDate: '2017-07-01',
        fileBuffer: gstDoc.buffer,
        sha256Hash: gstDoc.sha256Hash,
        metadata: { gstin: '27AABCU9603R1ZM', form: 'GST REG-06' },
      },
      {
        docType: 'UDYAM_CERTIFICATE',
        docName: 'MSME_Udyam_Registration_Certificate.pdf',
        uri: 'in.gov.msme.udyam.UDYAM-MH-01-0012345',
        mimeType: 'application/pdf',
        issuer: 'Ministry of Micro, Small and Medium Enterprises',
        issueDate: '2020-08-15',
        fileBuffer: udyamDoc.buffer,
        sha256Hash: udyamDoc.sha256Hash,
        metadata: { udyamNumber: 'UDYAM-MH-01-0012345', category: 'SMALL' },
      },
    ];
  }
}
