/**
 * LocalUploadConnector — Connector for direct user file uploads.
 *
 * Implements DocumentSourceConnector for local browser uploads.
 */
import { Injectable } from '@nestjs/common';
import type {
  DocumentSourceConnector,
  ExternalSourceFile,
  DownloadedSourceFile,
} from '@/modules/company-verification/domain/ports/DocumentSourceConnector.js';
import { BadRequestError } from '@/common/errors/errors.js';

@Injectable()
export class LocalUploadConnector implements DocumentSourceConnector {
  public readonly providerName = 'local';

  public async listFiles(): Promise<ExternalSourceFile[]> {
    return [];
  }

  public async downloadFile(authContext: Record<string, unknown>): Promise<DownloadedSourceFile> {
    const buffer = authContext.buffer as Buffer | undefined;
    const fileName = (authContext.fileName as string) || 'upload.pdf';
    const mimeType = (authContext.mimeType as string) || 'application/pdf';

    if (!buffer) {
      throw new BadRequestError('Local upload requires buffer content.');
    }

    return {
      buffer,
      fileName,
      mimeType,
      sizeBytes: buffer.byteLength,
    };
  }
}
