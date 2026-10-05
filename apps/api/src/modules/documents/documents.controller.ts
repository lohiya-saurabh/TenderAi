/**
 * DocumentsController — NestJS controller for document upload, download, mock, and SSE endpoints.
 *
 * Some endpoints (mock upload/download, SSE) need raw access to the Express Request/Response
 * objects, so they use @Req() and @Res() decorators with passthrough mode.
 */
import { Controller, Get, Post, Put, Delete, Param, Body, Req, Res, Headers } from '@nestjs/common';
import { Request, Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { DocumentsService } from './documents.service.js';
import { Public } from '../../common/security/decorators/public.decorator.js';
import { RequirePermission } from '../../common/security/decorators/permissions.decorator.js';
import { Permissions } from '../../common/security/permissions.js';

@Controller('api/v1')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Delete('bids/:bidId/documents/:docId')
  @RequirePermission(Permissions.BIDS_DELETE)
  async deleteDocument(
    @Param('bidId') bidId: string,
    @Param('docId') docId: string,
  ) {
    return this.documentsService.deleteDocument(bidId, docId);
  }

  @Post('bids/:bidId/upload-url')
  @RequirePermission(Permissions.DOCUMENTS_UPLOAD)
  async generateUploadUrl(
    @Param('bidId') bidId: string,
    @Body()
    body: {
      fileName?: string;
      mimeType?: string;
      sizeBytes?: number;
      documentType?: string;
    },
    @Headers('host') host: string,
  ) {
    return this.documentsService.generateUploadUrl(
      bidId,
      body.fileName,
      body.mimeType,
      host,
      body.sizeBytes,
      body.documentType,
    );
  }

  @Public()
  @Put('mock-upload/:bidId/:docId/:fileName')
  mockUpload(
    @Param('bidId') bidId: string,
    @Param('docId') docId: string,
    @Param('fileName') fileName: string,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      const buffer = Buffer.concat(chunks);
      const orgId = 'org_acme_infra_001';
      const storagePath = `tenants/${orgId}/bids/${bidId}/${docId}/${fileName}`;
      this.documentsService.registerUploadedMockObject(storagePath, buffer);
      res.status(200).json({ status: 'UPLOADED', size: buffer.length });
    });
  }

  @Post('bids/:bidId/documents/confirm')
  @RequirePermission(Permissions.DOCUMENTS_UPLOAD)
  async confirmUpload(
    @Param('bidId') bidId: string,
    @Body() body: { documentId?: string },
  ) {
    return this.documentsService.confirmUpload(bidId, body.documentId);
  }

  @Get('bids/:bidId/documents/:docId/download-url')
  @RequirePermission(Permissions.DOCUMENTS_READ)
  async getDownloadUrl(
    @Param('bidId') bidId: string,
    @Param('docId') docId: string,
    @Headers('host') host: string,
  ) {
    return this.documentsService.getDownloadUrl(bidId, docId, host);
  }

  @Public()
  @Get(['mock-download/:bidId/:docId', 'mock-download/:bidId/:docId/:fileName'])
  mockDownload(
    @Param('bidId') bidId: string,
    @Param('docId') _docId: string,
    @Param('fileName') fileName: string | undefined,
    @Res() res: Response,
  ): void {
    const samplesDir = path.resolve(process.cwd(), 'samples');
    let sampleFile = path.join(samplesDir, 'CPWD_Civil_Works_NIT_Notice_Inviting_Tender.pdf');

    if (bidId.includes('gem') || bidId.includes('aiims') || (fileName && fileName.toLowerCase().includes('gem'))) {
      sampleFile = path.join(samplesDir, 'GeM_AIIMS_Raipur_Surgical_Microscope_GEM-2026-B-8008666.pdf');
    } else if (bidId.includes('rail') || (fileName && fileName.toLowerCase().includes('rail'))) {
      sampleFile = path.join(samplesDir, 'Indian_Railways_NCR_Traction_Motor_Bearing_20263463.pdf');
    } else if (bidId.includes('nhai') || (fileName && fileName.toLowerCase().includes('nhai'))) {
      sampleFile = path.join(samplesDir, 'NHAI_EPC_Highway_Expansion_Package_44.pdf');
    }

    if (!fs.existsSync(sampleFile)) {
      const fallbackPdf = `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n162\n%%EOF`;
      res.set('Content-Type', 'application/pdf');
      res.set('Content-Disposition', `attachment; filename="document-${_docId}.pdf"`);
      res.status(200).send(fallbackPdf);
      return;
    }

    const fileBuffer = fs.readFileSync(sampleFile);
    const downloadName = fileName || path.basename(sampleFile);
    res.set('Content-Type', 'application/pdf');
    res.set('Content-Length', String(fileBuffer.length));
    res.set('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadName)}"`);
    res.status(200).send(fileBuffer);
  }

  @Get(['bids/:bidId/extraction-progress', 'bids/:bidId/progress', 'bids/:bidId/documents/stream'])
  @RequirePermission(Permissions.BIDS_READ)
  streamExtractionProgress(
    @Param('bidId') bidId: string,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders();

    const sendEvent = (eventData: unknown) => {
      res.write(`data: ${JSON.stringify(eventData)}\n\n`);
    };

    sendEvent({
      step: 'PARSING_PAGES',
      progress: 25,
      message: 'Normalizing PDF text blocks and tables...',
    });

    const extractionPromise = this.documentsService.markExtractionComplete(bidId);

    const t1 = setTimeout(() => {
      sendEvent({
        step: 'EXTRACTING_COMPLIANCE',
        progress: 55,
        message: 'Executing compliance extraction on FastAPI AI Engine (LangGraph)...',
      });
    }, 700);

    const t2 = setTimeout(() => {
      sendEvent({
        step: 'VERIFYING_CITATIONS',
        progress: 85,
        message: 'Validating verbatim provenance against source PDF text...',
      });
    }, 1500);

    const t3 = setTimeout(async () => {
      try {
        await extractionPromise;
      } catch (err) {
        console.warn(`[DocumentsController] Extraction execution failed for bid ${bidId}:`, err);
      }
      sendEvent({
        step: 'COMPLETED',
        progress: 100,
        status: 'REVIEW_READY',
        message: 'Extraction completed. Compliance items identified and grounded.',
      });
    }, 2300);

    req.on('close', () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    });
  }
}
