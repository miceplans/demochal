import { Body, Controller, Put } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { SaveInterestsDto } from './dto/save-interests.dto.js';
import type { SaveNotificationSettingsDto } from './dto/save-notification-settings.dto.js';
import { InterestsService } from './interests.service.js';

@Controller()
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Put('interests')
  saveInterests(@Body() dto: SaveInterestsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.interestsService.saveInterests(user.id, dto);
  }

  @Put('notification-settings')
  saveNotificationSettings(
    @Body() dto: SaveNotificationSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interestsService.saveNotificationSettings(user.id, dto);
  }
}
