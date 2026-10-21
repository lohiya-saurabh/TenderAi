/**
 * CompanyProfileModule — Company Capability Profile
 * feature module.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from '@/common/database/database.module.js';
import { CompanyProfileService } from '@/modules/company-profile/company-profile.service.js';
import { CompanyProfileRepository } from '@/modules/company-profile/company-profile.repository.js';
import { CompanyProfileController } from '@/modules/company-profile/presentation/CompanyProfileController.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CompanyProfileController],
  providers: [CompanyProfileService, CompanyProfileRepository],
  exports: [CompanyProfileService, CompanyProfileRepository],
})
export class CompanyProfileModule {}
