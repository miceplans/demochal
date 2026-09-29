import { Module } from '@nestjs/common';
import { AdminSettingsModule } from '../admin/admin-settings.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [AuthModule, AdminSettingsModule],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
