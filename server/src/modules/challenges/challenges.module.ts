import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ChallengesController } from './challenges.controller.js';
import { ChallengesService } from './challenges.service.js';
import { AdminSettingsModule } from '../admin/admin-settings.module.js';

@Module({
  imports: [AuthModule, AdminSettingsModule],
  controllers: [ChallengesController],
  providers: [ChallengesService],
  exports: [ChallengesService],
})
export class ChallengesModule {}
