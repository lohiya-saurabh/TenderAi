/**
 * IDigitalLockerPort — Domain port interface for DigiLocker OAuth2 consent & document import.
 *
 * Implements cloud/vendor agnostic architecture per AGENTS.md.
 * Allows TenderPulse AI to import digitally signed corporate certificates
 * directly from Indian government issuing authorities into the Evidence Vault.
 */

export interface DigiLockerAuthRequest {
  authorizationUrl: string;
  state: string;
}

export interface DigiLockerTokenResponse {
  accessToken: string;
  digiLockerId: string;
  name: string;
  dob?: string;
  gender?: string;
  expiresInSeconds?: number;
}

export interface DigiLockerIssuedDocument {
  docType: 'INCORPORATION_CERTIFICATE' | 'GST_CERTIFICATE' | 'UDYAM_CERTIFICATE' | 'PAN_CARD' | 'OTHER';
  docName: string;
  uri: string;
  mimeType: string;
  issuer: string;
  issueDate?: string;
  fileBuffer: Buffer;
  sha256Hash: string;
  metadata?: Record<string, unknown>;
}

export const DIGITAL_LOCKER_PORT = Symbol('IDigitalLockerPort');

export interface IDigitalLockerPort {
  /**
   * Generates the OAuth2 authorization URL and signed state token for user consent.
   */
  generateAuthUrl(tenantId: string, companyId: string, redirectUri: string): Promise<DigiLockerAuthRequest>;

  /**
   * Exchanges authorization code for an access token.
   */
  exchangeCodeForToken(code: string, state: string, redirectUri: string): Promise<DigiLockerTokenResponse>;

  /**
   * Fetches official issued documents for the authenticated DigiLocker account.
   */
  fetchIssuedDocuments(accessToken: string): Promise<DigiLockerIssuedDocument[]>;
}
