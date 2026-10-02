import { Module } from '@nestjs/common';
import { OutboxModule } from '../../outbox/outbox.module.js';
import { EmailService } from './email.service.js';

@Module({ imports: [OutboxModule], providers: [EmailService], exports: [EmailService] })
export class EmailModule {}
