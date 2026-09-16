import { Module } from '@nestjs/common';
import { AdminSettingsService } from './admin-settings.service.js';

@Module({
  providers: [AdminSettingsService],
  exports: [AdminSettingsService],
})
export class AdminSettingsModule {}
