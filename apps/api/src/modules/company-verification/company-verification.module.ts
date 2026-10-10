/**
 * CompanyVerificationModule — Dependency injection configuration for company evidence & verification layer.
 *
 * Implements cloud/vendor agnostic architecture per AGENTS.md.
 * Allows swapping between live adapters (IRIS IRP, MCA, Udyam, DigiLocker, Google Drive, OneDrive)
 * and zero-network deterministic mock adapters via environment variables.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../common/database/database.module.js';
import { StorageModule } from '../../infrastructure/storage/storage.module.js';
import { CompanyProfileModule } from '../company-profile/company-profile.module.js';

// Application Services
import { CompanyEvidenceService } from './application/CompanyEvidenceService.js';
import { EvidenceVerificationService } from './application/EvidenceVerificationService.js';

// Ports Tokens
import { BUSINESS_VERIFICATION_PROVIDER } from './domain/ports/BusinessVerificationProvider.js';
import { COMPANY_REGISTRY_PROVIDER } from './domain/ports/CompanyRegistryProvider.js';
import { MSME_VERIFICATION_PORT } from './domain/ports/IMsmeVerificationPort.js';
import { DIGITAL_DOCUMENT_PROVIDER } from './domain/ports/DigitalDocumentProvider.js';

// Infrastructure Adapters
import { IrisIrpGstAdapter } from './infrastructure/IrisIrpGstAdapter.js';
import { MockGstVerificationAdapter } from './infrastructure/MockGstVerificationAdapter.js';
import { McaRegistryAdapter } from './infrastructure/McaRegistryAdapter.js';
import { MockMcaRegistryAdapter } from './infrastructure/MockMcaRegistryAdapter.js';
import { UdyamVerificationAdapter } from './infrastructure/UdyamVerificationAdapter.js';
import { MockMsmeVerificationAdapter } from './infrastructure/MockMsmeVerificationAdapter.js';
import { DigiLockerAdapter } from './infrastructure/DigiLockerAdapter.js';
import { MockDigitalLockerAdapter } from './infrastructure/MockDigitalLockerAdapter.js';

// Connectors
import { LocalUploadConnector } from './infrastructure/LocalUploadConnector.js';
import { GoogleDriveConnector } from './infrastructure/GoogleDriveConnector.js';
import { OneDriveConnector } from './infrastructure/OneDriveConnector.js';

// Controllers
import { CompanyEvidenceController } from './presentation/CompanyEvidenceController.js';
import { CompanyVerificationController } from './presentation/CompanyVerificationController.js';

@Module({
  imports: [DatabaseModule, StorageModule, CompanyProfileModule],
  controllers: [CompanyEvidenceController, CompanyVerificationController],
  providers: [
    CompanyEvidenceService,
    EvidenceVerificationService,
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
        process.env.MCA_REGISTRY_PROVIDER === 'mca'
          ? McaRegistryAdapter
          : MockMcaRegistryAdapter,
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
  exports: [CompanyEvidenceService, EvidenceVerificationService],
})
export class CompanyVerificationModule {}
