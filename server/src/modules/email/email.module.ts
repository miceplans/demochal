import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { EmailService } from './email.service.js';

@Module({ imports: [NotificationsModule], providers: [EmailService], exports: [EmailService] })
export class EmailModule {}
