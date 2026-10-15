/**
 * CompaniesModule — Feature module for multi-company management within tenants.
 */
import { Module } from '@nestjs/common';
import { CompaniesService } from '@/modules/companies/companies.service.js';
import { CompaniesController } from '@/modules/companies/companies.controller.js';
import { CompanyProfileModule } from '@/modules/company-profile/company-profile.module.js';
import { BillingModule } from '@/modules/billing/billing.module.js';

@Module({
  imports: [CompanyProfileModule, BillingModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
