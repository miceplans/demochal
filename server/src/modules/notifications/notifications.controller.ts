import { Controller, Get, Headers } from '@nestjs/common';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@Headers('x-user-id') userId = '') {
    // TODO: replace header-based identification with an auth guard.
    return this.notificationsService.listForUser(userId);
  }
}
