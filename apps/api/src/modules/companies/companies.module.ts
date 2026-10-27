/**
 * CompaniesModule — NestJS module for managing tenant legal entities.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { CompaniesController } from '@/modules/companies/companies.controller.js';
import { CompaniesService } from '@/modules/companies/companies.service.js';
import { CompaniesRepository } from '@/modules/companies/companies.repository.js';
import { CompanyProfileModule } from '@/modules/company-profile/company-profile.module.js';
import { BillingModule } from '@/modules/billing/billing.module.js';

@Module({
  imports: [DatabaseModule, CompanyProfileModule, BillingModule],
  controllers: [CompaniesController],
  providers: [CompaniesService, CompaniesRepository],
  exports: [CompaniesService, CompaniesRepository],
})
export class CompaniesModule {}
