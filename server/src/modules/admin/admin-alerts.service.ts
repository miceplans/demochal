import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { users } from '../../db/schema.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { AdminSettingsService } from './admin-settings.service.js';

export type AdminAlertKey = 'reportAlert' | 'newBusinessAlert';

/**
 * 관리자 설정 스위치(reportAlert/newBusinessAlert)가 켜져 있으면 활성 관리자 전원에게 인앱
 * 알림을 남긴다. 알림은 부가 효과이므로 실패해도 원 요청(신고 접수/기관 등록)을 깨지 않는다.
 * 각 알림 insert는 NotificationsService.create가 트랜잭션으로 처리한다.
 */
@Injectable()
export class AdminAlertsService {
  private readonly logger = new Logger(AdminAlertsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly settings: AdminSettingsService,
    private readonly notifications: NotificationsService,
  ) {}

  async notify(key: AdminAlertKey, type: string, payload: Record<string, unknown>) {
    try {
      if (!(await this.settings.isEnabled(key))) return;
      const admins = await this.db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'admin'), eq(users.suspended, false)));
      await Promise.all(admins.map((admin) => this.notifications.create(admin.id, type, payload)));
    } catch (error) {
      this.logger.warn(`Admin alert '${key}' failed: ${(error as Error).message}`);
    }
  }
}
