import { Module } from '@nestjs/common';
import { BusinessesController } from './businesses.controller.js';
import { BusinessesService } from './businesses.service.js';
import { AdminSettingsModule } from '../admin/admin-settings.module.js';
import { FilesModule } from '../files/files.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { NtsClient } from '../verifications/clients/nts.client.js';

@Module({
  imports: [AuthModule, AdminSettingsModule, FilesModule],
  controllers: [BusinessesController],
  providers: [BusinessesService, NtsClient],
  exports: [BusinessesService],
})
export class BusinessesModule {}
