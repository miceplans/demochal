import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { Observable, Subject, filter, interval, map, merge } from 'rxjs';
import { env } from '../../config/env.js';
import { createPoolOptions } from '../../db/pool-options.js';
import {
  NOTIFICATION_CREATED_CHANNEL,
  parseNotificationCreatedEvent,
  type NotificationCreatedEvent,
} from './notification-events.js';

export interface NotificationSseMessage {
  type: 'notification' | 'ping';
  data: { notificationId?: string };
}

// ALB idle timeout defaults to 60s; keep the stream under it.
const HEARTBEAT_MS = 25_000;
const RECONNECT_MS = 5_000;

/**
 * API-only (not registered in WorkerModule). Holds one dedicated LISTEN connection per
 * process and fans events out to the SSE streams of the matching user. Notifications can be
 * created by any API task or by the worker, so in-process pub/sub alone would miss them.
 *
 * LISTEN needs a session-level connection: it does not work through a transaction-pooling
 * proxy (RDS Proxy / PgBouncer), so DATABASE_URL must point at the DB directly.
 */
@Injectable()
export class NotificationsStreamService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsStreamService.name);
  private readonly events = new Subject<NotificationCreatedEvent>();
  private client: Client | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.events.complete();
    await this.client?.end().catch(() => undefined);
  }

  streamFor(userId: string): Observable<NotificationSseMessage> {
    return merge(
      this.events.pipe(
        filter((event) => event.userId === userId),
        map((event): NotificationSseMessage => ({
          type: 'notification',
          data: { notificationId: event.notificationId },
        })),
      ),
      interval(HEARTBEAT_MS).pipe(map((): NotificationSseMessage => ({ type: 'ping', data: {} }))),
    );
  }

  /** Exposed for tests; called for every NOTIFY received on the channel. */
  handleRaw(raw: string | undefined) {
    const event = parseNotificationCreatedEvent(raw);
    if (event) this.events.next(event);
  }

  private async connect() {
    if (this.stopped) return;
    const client = new Client(createPoolOptions(env.databaseUrl, env.databaseSslCaPath));
    this.client = client;
    client.on('notification', (message) => this.handleRaw(message.payload));
    // 'error' fires on connection loss after connect; 'end' follows. Either drops this client.
    client.on('error', (error) => {
      this.logger.warn(`LISTEN connection error: ${error.message}`);
      this.scheduleReconnect(client);
    });
    client.on('end', () => this.scheduleReconnect(client));
    try {
      await client.connect();
      await client.query(`LISTEN ${NOTIFICATION_CREATED_CHANNEL}`);
    } catch (error) {
      // Realtime is best-effort (the list endpoint stays the source of truth), so never
      // fail app boot because LISTEN is unavailable.
      this.logger.warn(`LISTEN setup failed: ${(error as Error).message}`);
      this.scheduleReconnect(client);
    }
  }

  private scheduleReconnect(client: Client) {
    // Ignore stale clients and the duplicate error/end pair of the current one.
    if (this.stopped || this.client !== client) return;
    this.client = null;
    void client.end().catch(() => undefined);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, RECONNECT_MS);
  }
}
