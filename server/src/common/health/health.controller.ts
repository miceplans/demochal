import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE, type Database } from '../../db/drizzle.provider.js';
import { Public } from '../auth/public.decorator.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  @Public()
  @Get()
  async check() {
    try {
      await this.db.execute(sql`select 1`);
    } catch {
      // ALB target-group health checks key off this status: a DB outage must
      // fail the check (503), not report a false "ok".
      throw new ServiceUnavailableException({
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
