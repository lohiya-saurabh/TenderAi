/**
 * GoogleDriveConnector — Infrastructure adapter for Google Drive API.
 *
 * Implements DocumentSourceConnector for importing existing company evidence
 * (audited accounts, work orders, completion certificates, ISO certificates).
 * Supports live Google Drive REST API with fallback to deterministic dev/mock files.
 */
import { Injectable, Logger } from '@nestjs/common';
import type {
  DocumentSourceConnector,
  ExternalSourceFile,
  DownloadedSourceFile,
} from '../domain/ports/DocumentSourceConnector.js';
import { BadRequestError, InternalServerError } from '../../../common/errors/errors.js';

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

    // Dev/Test Mock Mode: Returns typical Indian procurement company evidence
    return [
      {
        id: 'gdrive_file_audited_fy24',
        name: 'ACME_Audited_Balance_Sheet_FY24.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1542000,
        modifiedTime: '2024-09-30T10:00:00.000Z',
        folderPath: '/Financials/Audited',
      },
      {
        id: 'gdrive_file_nhai_completion',
        name: 'NHAI_STRR_Package_Completion_Certificate.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 890400,
        modifiedTime: '2024-05-15T14:30:00.000Z',
        folderPath: '/Experience/Highways',
      },
      {
        id: 'gdrive_file_iso_9001',
        name: 'ISO_9001_2015_Quality_Certificate.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 450200,
        modifiedTime: '2023-11-10T09:15:00.000Z',
        folderPath: '/Certifications',
      },
      {
        id: 'gdrive_file_oem_maf',
        name: 'Wirtgen_Group_OEM_Authorization_2024.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 320100,
        modifiedTime: '2024-01-20T11:45:00.000Z',
        folderPath: '/OEM_MAF',
      },
    ];
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

    // Mock download generator
    const content = `%PDF-1.4\n%Google-Drive-Imported-Evidence\nFile ID: ${externalFileId}\nImportedAt: ${new Date().toISOString()}\n%%EOF`;
    const buffer = Buffer.from(content, 'utf-8');
    const fileName = (authContext?.fileName as string) || `${externalFileId}.pdf`;

    return {
      buffer,
      fileName,
      mimeType: 'application/pdf',
      sizeBytes: buffer.byteLength,
    };
  }
}
