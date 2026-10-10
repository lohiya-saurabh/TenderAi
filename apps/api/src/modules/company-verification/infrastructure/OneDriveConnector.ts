/**
 * OneDriveConnector — Infrastructure adapter for Microsoft OneDrive / SharePoint via Microsoft Graph API.
 *
 * Implements DocumentSourceConnector for enterprise customers managing corporate
 * bidding documents in Microsoft 365 environments.
 */
import { Injectable, Logger } from '@nestjs/common';
import type {
  DocumentSourceConnector,
  ExternalSourceFile,
  DownloadedSourceFile,
} from '../domain/ports/DocumentSourceConnector.js';
import { BadRequestError, InternalServerError } from '../../../common/errors/errors.js';

interface GraphDriveItemsResponse {
  value?: Array<{
    id?: string;
    name?: string;
    size?: number;
    lastModifiedDateTime?: string;
    file?: { mimeType?: string };
  }>;
}

@Injectable()
export class OneDriveConnector implements DocumentSourceConnector {
  public readonly providerName = 'onedrive';
  private readonly logger = new Logger(OneDriveConnector.name);

  public async listFiles(
    authContext?: Record<string, unknown>,
    folderId?: string,
  ): Promise<ExternalSourceFile[]> {
    const accessToken = authContext?.accessToken as string | undefined;

    if (accessToken) {
      try {
        const path = folderId ? `/me/drive/items/${folderId}/children` : `/me/drive/root/children`;
        const url = `https://graph.microsoft.com/v1.0${path}?$filter=endswith(name,'.pdf')&$select=id,name,size,lastModifiedDateTime,file`;

        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          throw new BadRequestError('Failed to list files from OneDrive.');
        }

        const data = (await response.json()) as GraphDriveItemsResponse;
        return (data.value || []).map((item) => ({
          id: item.id || 'unknown_item',
          name: item.name || 'document.pdf',
          mimeType: item.file?.mimeType || 'application/pdf',
          sizeBytes: item.size || 102400,
          modifiedTime: item.lastModifiedDateTime,
        }));
      } catch (err: unknown) {
        if (err instanceof BadRequestError) throw err;
        this.logger.error(`Error connecting to Microsoft Graph: ${err instanceof Error ? err.message : String(err)}`);
        throw new InternalServerError('Unable to connect to Microsoft Graph service.');
      }
    }

    // Mock mode
    return [
      {
        id: 'onedrive_file_ca_networth',
        name: 'Chartered_Accountant_Networth_Certificate_UDIN.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 654000,
        modifiedTime: '2024-08-10T12:00:00.000Z',
      },
      {
        id: 'onedrive_file_msrdc_work_order',
        name: 'MSRDC_Expressway_Package_45_Work_Order.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1200300,
        modifiedTime: '2024-03-01T08:00:00.000Z',
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
        const url = `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(externalFileId)}/content`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          throw new BadRequestError('Failed to download file from OneDrive.');
        }

        const arrayBuf = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuf);
        return {
          buffer,
          fileName: (authContext?.fileName as string) || `onedrive_${externalFileId}.pdf`,
          mimeType: 'application/pdf',
          sizeBytes: buffer.byteLength,
        };
      } catch (err: unknown) {
        if (err instanceof BadRequestError) throw err;
        throw new InternalServerError('Error downloading file from OneDrive.');
      }
    }

    const content = `%PDF-1.4\n%OneDrive-Imported-Evidence\nFile ID: ${externalFileId}\nImportedAt: ${new Date().toISOString()}\n%%EOF`;
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
