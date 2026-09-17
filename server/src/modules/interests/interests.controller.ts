import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { SaveInterestsDto } from './dto/save-interests.dto.js';
import type { SaveNotificationSettingsDto } from './dto/save-notification-settings.dto.js';
import { InterestsService } from './interests.service.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Put('interests')
  saveInterests(@Body() dto: SaveInterestsDto, @CurrentUser() user: AuthUser) {
    return this.interestsService.saveInterests(user.id, dto);
  }

  @Put('notification-settings')
  saveNotificationSettings(
    @Body() dto: SaveNotificationSettingsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.interestsService.saveNotificationSettings(user.id, dto);
  }
}
