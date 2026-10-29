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
} from '@/modules/company-verification/domain/ports/DocumentSourceConnector.js';
import { BadRequestError, InternalServerError } from '@/common/errors/errors.js';

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
        this.logger.error(
          `Error connecting to Microsoft Graph: ${err instanceof Error ? err.message : String(err)}`,
        );
        throw new InternalServerError('Unable to connect to Microsoft Graph service.');
      }
    }

    // No connection: never invent files.
    throw new BadRequestError('OneDrive is not connected. Drive import needs an OAuth connection, which is not available yet; upload the file directly.');
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

    throw new BadRequestError(
      'OneDrive is not connected. Drive import needs an OAuth connection, which is not available yet; upload the file directly.',
    );
  }
}
