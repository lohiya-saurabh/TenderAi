/**
 * CompanyVerificationModule — Dependency injection configuration for company evidence & verification layer.
 *
 * Implements cloud/vendor agnostic architecture per AGENTS.md.
 * Allows swapping between live adapters (IRIS IRP, MCA, Udyam, DigiLocker, Google Drive, OneDrive)
 * and zero-network deterministic mock adapters via environment variables.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { StorageModule } from '@/infrastructure/storage/storage.module.js';
import { CompanyProfileModule } from '@/modules/company-profile/company-profile.module.js';

// Application Services
import { CompanyEvidenceService } from '@/modules/company-verification/application/CompanyEvidenceService.js';
import { EvidenceVerificationService } from '@/modules/company-verification/application/EvidenceVerificationService.js';

// Ports Tokens
import { BUSINESS_VERIFICATION_PROVIDER } from '@/modules/company-verification/domain/ports/BusinessVerificationProvider.js';
import { COMPANY_REGISTRY_PROVIDER } from '@/modules/company-verification/domain/ports/CompanyRegistryProvider.js';
import { MSME_VERIFICATION_PORT } from '@/modules/company-verification/domain/ports/IMsmeVerificationPort.js';
import { DIGITAL_DOCUMENT_PROVIDER } from '@/modules/company-verification/domain/ports/DigitalDocumentProvider.js';

// Infrastructure Adapters
import { IrisIrpGstAdapter } from '@/modules/company-verification/infrastructure/IrisIrpGstAdapter.js';
import { MockGstVerificationAdapter } from '@/modules/company-verification/infrastructure/MockGstVerificationAdapter.js';
import { McaRegistryAdapter } from '@/modules/company-verification/infrastructure/McaRegistryAdapter.js';
import { MockMcaRegistryAdapter } from '@/modules/company-verification/infrastructure/MockMcaRegistryAdapter.js';
import { UdyamVerificationAdapter } from '@/modules/company-verification/infrastructure/UdyamVerificationAdapter.js';
import { MockMsmeVerificationAdapter } from '@/modules/company-verification/infrastructure/MockMsmeVerificationAdapter.js';
import { DigiLockerAdapter } from '@/modules/company-verification/infrastructure/DigiLockerAdapter.js';
import { MockDigitalLockerAdapter } from '@/modules/company-verification/infrastructure/MockDigitalLockerAdapter.js';

// Connectors
import { LocalUploadConnector } from '@/modules/company-verification/infrastructure/LocalUploadConnector.js';
import { GoogleDriveConnector } from '@/modules/company-verification/infrastructure/GoogleDriveConnector.js';
import { OneDriveConnector } from '@/modules/company-verification/infrastructure/OneDriveConnector.js';
import { AiEvidenceExtractor } from '@/modules/company-verification/application/AiEvidenceExtractor.js';

// Controllers
import { CompanyEvidenceController } from '@/modules/company-verification/presentation/CompanyEvidenceController.js';
import { CompanyVerificationController } from '@/modules/company-verification/presentation/CompanyVerificationController.js';

@Module({
  imports: [DatabaseModule, StorageModule, CompanyProfileModule],
  controllers: [CompanyEvidenceController, CompanyVerificationController],
  providers: [
    CompanyEvidenceService,
    EvidenceVerificationService,
    AiEvidenceExtractor,
    LocalUploadConnector,
    GoogleDriveConnector,
    OneDriveConnector,

    // GST Verification Provider (IRIS IRP vs Mock)
    {
      provide: BUSINESS_VERIFICATION_PROVIDER,
      useClass:
        process.env.GST_VERIFICATION_PROVIDER === 'iris'
          ? IrisIrpGstAdapter
          : MockGstVerificationAdapter,
    },

    // MCA Registry Provider (MCA vs Mock)
    {
      provide: COMPANY_REGISTRY_PROVIDER,
      useClass:
        process.env.MCA_REGISTRY_PROVIDER === 'mca' ? McaRegistryAdapter : MockMcaRegistryAdapter,
    },

    // MSME Udyam Verification Port (Udyam vs Mock)
    {
      provide: MSME_VERIFICATION_PORT,
      useClass:
        process.env.MSME_VERIFICATION_PROVIDER === 'udyam'
          ? UdyamVerificationAdapter
          : MockMsmeVerificationAdapter,
    },

    // Digital Document Provider (DigiLocker vs Mock)
    {
      provide: DIGITAL_DOCUMENT_PROVIDER,
      useClass:
        process.env.DIGILOCKER_PROVIDER === 'digilocker'
          ? DigiLockerAdapter
          : MockDigitalLockerAdapter,
    },
  ],
  exports: [CompanyEvidenceService, EvidenceVerificationService, AiEvidenceExtractor],
})
export class CompanyVerificationModule {}
