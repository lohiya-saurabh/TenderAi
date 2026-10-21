/**
 * CompanyVerificationModule — Dependency injection configuration for company evidence & verification layer.
 *
 * Implements cloud/vendor agnostic architecture per AGENTS.md.
 * Allows swapping between live adapters (IRIS IRP, MCA, Udyam, DigiLocker, Google Drive, OneDrive)
 * and zero-network deterministic mock adapters via environment variables.
 */
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseModule } from '@/common/database/database.module.js';
import { StorageModule } from '@/infrastructure/storage/storage.module.js';
import { CompanyProfileModule } from '@/modules/company-profile/company-profile.module.js';

// Application Services
import { CompanyEvidenceService } from '@/modules/company-verification/application/CompanyEvidenceService.js';
import { EvidenceVerificationService } from '@/modules/company-verification/application/EvidenceVerificationService.js';
import { CompanyVerificationRepository } from '@/modules/company-verification/company-verification.repository.js';

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
    CompanyVerificationRepository,
    AiEvidenceExtractor,
    LocalUploadConnector,
    GoogleDriveConnector,
    OneDriveConnector,

    // GST Verification Provider (IRIS IRP vs Mock)
    {
      provide: BUSINESS_VERIFICATION_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('GST_VERIFICATION_PROVIDER');
        return provider === 'iris'
          ? new IrisIrpGstAdapter(configService)
          : new MockGstVerificationAdapter();
      },
      inject: [ConfigService],
    },

    // MCA Registry Provider (MCA vs Mock)
    {
      provide: COMPANY_REGISTRY_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('MCA_REGISTRY_PROVIDER');
        return provider === 'mca'
          ? new McaRegistryAdapter(configService)
          : new MockMcaRegistryAdapter();
      },
      inject: [ConfigService],
    },

    // MSME Udyam Verification Port (Udyam vs Mock)
    {
      provide: MSME_VERIFICATION_PORT,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('MSME_VERIFICATION_PROVIDER');
        return provider === 'udyam'
          ? new UdyamVerificationAdapter(configService)
          : new MockMsmeVerificationAdapter();
      },
      inject: [ConfigService],
    },

    // Digital Document Provider (DigiLocker vs Mock)
    {
      provide: DIGITAL_DOCUMENT_PROVIDER,
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('DIGILOCKER_PROVIDER');
        return provider === 'digilocker'
          ? new DigiLockerAdapter(configService)
          : new MockDigitalLockerAdapter(configService);
      },
      inject: [ConfigService],
    },
  ],
  exports: [CompanyEvidenceService, EvidenceVerificationService, CompanyVerificationRepository, AiEvidenceExtractor],
})
export class CompanyVerificationModule {}
