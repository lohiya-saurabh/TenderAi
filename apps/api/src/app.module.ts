/**
 * AppModule — Root NestJS module that imports all feature and infrastructure modules.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from './common/database/database.module.js';
import { SecurityModule } from './common/security/security.module.js';
import { StorageModule } from './infrastructure/storage/storage.module.js';
import { QueueModule } from './infrastructure/queue/queue.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BidsModule } from './modules/bids/bids.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ComplianceModule } from './modules/compliance/compliance.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { CompanyProfileModule } from './modules/company-profile/company-profile.module.js';
import { CompaniesModule } from './modules/companies/companies.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';
import { NotificationsModule } from './modules/notifications/notifications.module.js';
import { BillingModule } from './modules/billing/billing.module.js';

@Module({
  imports: [
    // Infrastructure (global providers)
    DatabaseModule,
    SecurityModule,
    StorageModule,
    QueueModule,

    // Feature modules
    AuthModule,
    BidsModule,
    DocumentsModule,
    ComplianceModule,
    AuditModule,
    CompanyProfileModule,
    CompaniesModule,
    DashboardModule,
    UsersModule,
    SettingsModule,
    TeamsModule,
    NotificationsModule,
    BillingModule,
  ],
})
export class AppModule {}
