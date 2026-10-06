import { Controller, Header, Sse, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { NotificationsStreamService } from './notifications-stream.service.js';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsStreamController {
  constructor(private readonly streamService: NotificationsStreamService) {}

  // SSE: the client re-lists via GET /notifications on each event, so only the id is sent.
  @Sse('stream')
  @Header('Cache-Control', 'no-cache, no-transform')
  @Header('X-Accel-Buffering', 'no')
  stream(@CurrentUser() user: AuthenticatedUser) {
    return this.streamService.streamFor(user.id);
  }
}
