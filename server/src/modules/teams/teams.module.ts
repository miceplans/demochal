import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { TeamsController } from './teams.controller.js';
import { TeamsService } from './teams.service.js';

@Module({
  imports: [NotificationsModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
