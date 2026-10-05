/**
 * CompaniesModule — Feature module for multi-company management within tenants.
 */
import { Module } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { CompaniesController } from './companies.controller.js';
import { CompanyProfileModule } from '../company-profile/company-profile.module.js';

@Module({
  imports: [CompanyProfileModule],
  controllers: [CompaniesController],
  providers: [CompaniesService],
  exports: [CompaniesService],
})
export class CompaniesModule {}
