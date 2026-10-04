/**
 * AppModule — Root NestJS module that imports all feature and infrastructure modules.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from './common/database/database.module.js';
import { StorageModule } from './infrastructure/storage/storage.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BidsModule } from './modules/bids/bids.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ComplianceModule } from './modules/compliance/compliance.module.js';
import { AuditModule } from './modules/audit/audit.module.js';

@Module({
  imports: [
    // Infrastructure (global providers)
    DatabaseModule,
    StorageModule,

    // Feature modules
    AuthModule,
    BidsModule,
    DocumentsModule,
    ComplianceModule,
    AuditModule,
  ],
})
export class AppModule {}
