/**
 * CompanyProfileModule — Company Capability Profile
 * feature module.
 */
import { Module } from '@nestjs/common';
import { CompanyProfileService } from '@/modules/company-profile/company-profile.service.js';
import { CompanyProfileController } from '@/modules/company-profile/presentation/CompanyProfileController.js';

@Module({
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService],
  exports: [CompanyProfileService],
})
export class CompanyProfileModule {}
