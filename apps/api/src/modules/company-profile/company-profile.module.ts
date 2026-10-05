/**
 * CompanyProfileModule — Company Capability Profile
 * feature module.
 */
import { Module } from '@nestjs/common';
import { CompanyProfileService } from './company-profile.service.js';
import { CompanyProfileController } from './presentation/CompanyProfileController.js';

@Module({
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService],
  exports: [CompanyProfileService],
})
export class CompanyProfileModule {}
