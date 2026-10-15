/**
 * DigitalDocumentProvider — Domain port interface for digital document depositories.
 *
 * Implements retrieval of government-issued digital certificates (DigiLocker, API Setu).
 */
import type { IDigitalLockerPort } from '@/modules/company-verification/domain/ports/IDigitalLockerPort.js';

export type DigitalDocumentProvider = IDigitalLockerPort;
export const DIGITAL_DOCUMENT_PROVIDER = Symbol('DigitalDocumentProvider');
export type {
  IDigitalLockerPort,
  DigiLockerAuthRequest,
  DigiLockerTokenResponse,
  DigiLockerIssuedDocument,
} from '@/modules/company-verification/domain/ports/IDigitalLockerPort.js';
