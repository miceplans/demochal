import { Module } from '@nestjs/common';
import { OutboxModule } from '../../outbox/outbox.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { EmailService } from './email.service.js';

@Module({
  imports: [NotificationsModule, OutboxModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
