/**
 * GoogleDriveConnector — Infrastructure adapter for Google Drive API.
 *
 * Implements DocumentSourceConnector for importing existing company evidence
 * (audited accounts, work orders, completion certificates, ISO certificates).
 * Supports the live Google Drive REST API when an OAuth token is supplied; without one it refuses.
 */
import { Injectable, Logger } from '@nestjs/common';
import type {
  DocumentSourceConnector,
  ExternalSourceFile,
  DownloadedSourceFile,
} from '@/modules/company-verification/domain/ports/DocumentSourceConnector.js';
import { BadRequestError, InternalServerError } from '@/common/errors/errors.js';

interface GoogleDriveFileListResponse {
  files?: Array<{
    id?: string;
    name?: string;
    mimeType?: string;
    size?: string;
    modifiedTime?: string;
  }>;
}

@Injectable()
export class GoogleDriveConnector implements DocumentSourceConnector {
  public readonly providerName = 'google-drive';
  private readonly logger = new Logger(GoogleDriveConnector.name);

  public async listFiles(
    authContext?: Record<string, unknown>,
    folderId?: string,
  ): Promise<ExternalSourceFile[]> {
    const accessToken = authContext?.accessToken as string | undefined;

    // Production: Call Google Drive v3 REST API when OAuth token is supplied
    if (accessToken) {
      try {
        const queryParts = ['trashed = false', "mimeType = 'application/pdf'"];
        if (folderId) {
          queryParts.push(`'${folderId}' in parents`);
        }
        const q = encodeURIComponent(queryParts.join(' and '));
        const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,mimeType,size,modifiedTime)&pageSize=50`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          const errText = await response.text();
          this.logger.error(`Google Drive API error (${response.status}): ${errText}`);
          throw new BadRequestError('Failed to list files from Google Drive.');
        }

        const data = (await response.json()) as GoogleDriveFileListResponse;
        return (data.files || []).map((f) => ({
          id: f.id || 'unknown_id',
          name: f.name || 'unnamed.pdf',
          mimeType: f.mimeType || 'application/pdf',
          sizeBytes: parseInt(f.size || '102400', 10),
          modifiedTime: f.modifiedTime,
        }));
      } catch (err: unknown) {
        if (err instanceof BadRequestError) throw err;
        this.logger.error(
          `Error connecting to Google Drive API: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw new InternalServerError('Unable to connect to Google Drive service.');
      }
    }

    // No connection: never invent files.
    throw new BadRequestError('Google Drive is not connected. Drive import needs an OAuth connection, which is not available yet; upload the file directly.');
  }

  public async downloadFile(
    authContext: Record<string, unknown>,
    externalFileId: string,
  ): Promise<DownloadedSourceFile> {
    const accessToken = authContext?.accessToken as string | undefined;

    if (accessToken) {
      try {
        const url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(externalFileId)}?alt=media`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          throw new BadRequestError(
            `Failed to download file from Google Drive (${response.status}).`,
          );
        }

        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        return {
          buffer,
          fileName: (authContext?.fileName as string) || `gdrive_${externalFileId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: buffer.byteLength,
        };
      } catch (err: unknown) {
        if (err instanceof BadRequestError) throw err;
        throw new InternalServerError('Error downloading file from Google Drive.');
      }
    }

    throw new BadRequestError('Google Drive is not connected. Drive import needs an OAuth connection, which is not available yet; upload the file directly.');
  }
}
