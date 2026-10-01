import { Module } from '@nestjs/common';
import { OutboxRelayService } from './outbox-relay.service.js';
import { OutboxService } from './outbox.service.js';

// Imported by AppModule (writers, via VerificationsModule) and WorkerModule
// (the relay poller in worker.ts).
@Module({
  providers: [OutboxService, OutboxRelayService],
  exports: [OutboxService, OutboxRelayService],
})
export class OutboxModule {}
