import { v4 as uuidv4 } from 'uuid';
import { IAuditRepository } from '../../audit/domain/repositories/IAuditRepository.js';
import { AuditLog } from '../../audit/domain/entities/AuditLog.js';
import {
  EntityNotFoundException,
  ValidationException,
} from '../../../common/domain/DomainException.js';
import { TenantContextHolder } from '../../../common/security/TenantContext.js';
import { Permissions } from '../../../common/security/permissions.js';
import { IBidRepository } from '../domain/repositories/IBidRepository.js';
import { ITenderDocumentRepository } from '../domain/repositories/ITenderDocumentRepository.js';
import { IStorageService } from './IStorageService.js';
import { DocumentStatus } from '../domain/value-objects/DocumentStatus.js';

export interface GetDocumentDownloadUrlCommand {
  organizationId: string;
  userId: string;
  bidId: string;
  documentId: string;
}

export interface GetDocumentDownloadUrlResult {
  documentId: string;
  downloadUrl: string;
  fileName: string;
  expiresInSeconds: number;
}

export class GetDocumentDownloadUrlUseCase {
  constructor(
    private readonly bidRepository: IBidRepository,
    private readonly documentRepository: ITenderDocumentRepository,
    private readonly storageService: IStorageService,
    private readonly auditRepository: IAuditRepository
  ) {}

  public async execute(
    command: GetDocumentDownloadUrlCommand
  ): Promise<GetDocumentDownloadUrlResult> {
    // 1. RBAC Authorization check
    TenantContextHolder.requirePermission(Permissions.DOCUMENTS_READ);

    // 2. Anti-IDOR: Scoped lookup of Bid
    const bid = await this.bidRepository.findById(command.bidId, command.organizationId);
    if (!bid) {
      throw new EntityNotFoundException('Bid', command.bidId);
    }

    // 3. Anti-IDOR: Scoped lookup of TenderDocument
    const document = await this.documentRepository.findById(
      command.documentId,
      command.organizationId
    );
    if (!document) {
      throw new EntityNotFoundException('TenderDocument', command.documentId);
    }

    // 4. Invariant: Cross-resource ownership check
    if (document.bidId !== bid.id) {
      throw new ValidationException('Document does not belong to the specified bid.');
    }

    // 5. Invariant: Only verified documents may be downloaded
    if (!document.status.equals(DocumentStatus.VERIFIED)) {
      throw new ValidationException(
        `Cannot generate download URL: Document is in '${document.status.value}' state. Must be VERIFIED.`
      );
    }

    // 6. Generate presigned GET download URL with short TTL (5 min = 300s) and attachment disposition
    const expiresInSeconds = 300;
    const downloadUrl = await this.storageService.generatePresignedDownloadUrl(
      document.s3Key,
      document.fileName,
      expiresInSeconds
    );

    // 7. Audit log event
    await this.auditRepository.save(
      new AuditLog({
        id: uuidv4(),
        organizationId: command.organizationId,
        userId: command.userId,
        action: 'DOWNLOAD_DOCUMENT',
        entityType: 'TenderDocument',
        entityId: document.id,
        diff: {
          bidId: bid.id,
          fileName: document.fileName,
          s3Key: document.s3Key,
          expiresInSeconds,
        },
      })
    );

    return {
      documentId: document.id,
      downloadUrl,
      fileName: document.fileName,
      expiresInSeconds,
    };
  }
}
