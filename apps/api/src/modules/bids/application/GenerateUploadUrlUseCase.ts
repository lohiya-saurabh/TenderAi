import { v4 as uuidv4 } from 'uuid';
import { IAuditRepository } from '../../audit/domain/repositories/IAuditRepository.js';
import { AuditLog } from '../../audit/domain/entities/AuditLog.js';
import {
  EntityNotFoundException,
  ValidationException,
} from '../../../common/domain/DomainException.js';
import { TenantContextHolder } from '../../../common/security/TenantContext.js';
import { Permissions } from '../../../common/security/permissions.js';
import { TenderDocument, DocumentType } from '../domain/entities/TenderDocument.js';
import { IBidRepository } from '../domain/repositories/IBidRepository.js';
import { ITenderDocumentRepository } from '../domain/repositories/ITenderDocumentRepository.js';
import { IStorageService } from './IStorageService.js';
import path from 'node:path';
import { IUnitOfWork, DirectUnitOfWork } from '../../../common/database/IUnitOfWork.js';

export interface GenerateUploadUrlCommand {
  organizationId: string;
  userId: string;
  bidId: string;
  documentType: DocumentType;
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  checksumSha256: string;
}

export interface GenerateUploadUrlResult {
  documentId: string;
  uploadUrl: string;
  storagePath: string;
  s3Key: string; // Legacy alias for storagePath
  expiresInSeconds: number;
}

export class GenerateUploadUrlUseCase {
  constructor(
    private readonly bidRepository: IBidRepository,
    private readonly documentRepository: ITenderDocumentRepository,
    private readonly storageService: IStorageService,
    private readonly auditRepository: IAuditRepository,
    private readonly unitOfWork: IUnitOfWork = new DirectUnitOfWork(),
  ) {}

  public async execute(command: GenerateUploadUrlCommand): Promise<GenerateUploadUrlResult> {
    // 1. RBAC Authorization check
    TenantContextHolder.requirePermission(Permissions.DOCUMENTS_UPLOAD);

    // 2. Anti-IDOR: Verify bid exists within the authenticated organization boundary
    const bid = await this.bidRepository.findById(command.bidId, command.organizationId);
    if (!bid) {
      // Must return 404 (EntityNotFoundException) to prevent tenant resource enumeration
      throw new EntityNotFoundException('Bid', command.bidId);
    }

    // 3. Prevent duplicate document upload within the same bid
    const existingDoc = await this.documentRepository.findByChecksum(
      command.bidId,
      command.checksumSha256,
      command.organizationId,
    );
    if (existingDoc) {
      throw new ValidationException(
        `Duplicate document: A document with identical checksum '${command.checksumSha256}' is already registered for this bid ('${existingDoc.fileName}').`,
      );
    }

    // 4. Generate deterministic S3 Key following tenant isolation scheme
    const documentId = uuidv4();
    const baseName = path.basename(command.fileName);
    const sanitizedFileName = baseName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const s3Key = `tenants/${command.organizationId}/bids/${command.bidId}/${documentId}/${sanitizedFileName}`;

    // 5. Create domain entity (enforces invariants on size, MIME type, checksum format)
    const document = new TenderDocument({
      id: documentId,
      bidId: command.bidId,
      organizationId: command.organizationId,
      documentType: command.documentType,
      fileName: command.fileName,
      s3Key,
      sizeBytes: command.sizeBytes,
      mimeType: command.mimeType,
      checksumSha256: command.checksumSha256,
    });

    // 6. Generate presigned PUT URL with 15-minute expiration
    const expiresInSeconds = 900;
    const uploadUrl = await this.storageService.generatePresignedUploadUrl(
      s3Key,
      command.mimeType,
      expiresInSeconds,
    );

    // 7. Atomic transaction: Save document record in PENDING_UPLOAD status & write audit log
    await this.unitOfWork.withTransaction(async () => {
      await this.documentRepository.save(document);
      await this.auditRepository.save(
        new AuditLog({
          id: uuidv4(),
          organizationId: command.organizationId,
          userId: command.userId,
          action: 'GENERATE_UPLOAD_URL',
          entityType: 'TenderDocument',
          entityId: document.id,
          diff: {
            bidId: command.bidId,
            fileName: command.fileName,
            documentType: command.documentType,
            sizeBytes: command.sizeBytes,
          },
        }),
      );
    });

    return {
      documentId: document.id,
      uploadUrl,
      storagePath: s3Key,
      s3Key,
      expiresInSeconds,
    };
  }
}
