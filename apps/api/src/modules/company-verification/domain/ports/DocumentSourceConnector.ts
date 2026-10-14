/**
 * DocumentSourceConnector — Domain port interface for external document repositories.
 *
 * Supports importing existing company evidence (audited accounts, work orders,
 * completion certificates, ISO certificates, OEM authorizations) from:
 * 1. Google Drive (Google Drive API)
 * 2. Microsoft OneDrive / SharePoint (Microsoft Graph API)
 * 3. Direct Local Upload
 */

export interface ExternalSourceFile {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  downloadUrl?: string;
  modifiedTime?: string;
  folderPath?: string;
}

export interface DownloadedSourceFile {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

export interface DocumentSourceConnector {
  readonly providerName: string; // 'local' | 'google-drive' | 'onedrive'

  /**
   * List files available for import from the external repository.
   */
  listFiles(
    authContext?: Record<string, unknown>,
    folderId?: string,
  ): Promise<ExternalSourceFile[]>;

  /**
   * Download a specific file's binary stream for persistent object storage.
   */
  downloadFile(
    authContext: Record<string, unknown>,
    externalFileId: string,
  ): Promise<DownloadedSourceFile>;
}

export const DOCUMENT_SOURCE_CONNECTOR = Symbol('DocumentSourceConnector');
