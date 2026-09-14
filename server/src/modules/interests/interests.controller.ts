import { Body, Controller, Put, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { InterestsService } from './interests.service.js';
import { SaveInterestsDto } from './dto/save-interests.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Put('interests')
  saveInterests(@Body() dto: SaveInterestsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.interestsService.saveInterests(user.id, dto.categories);
  }

  @Put('notification-settings')
  saveNotificationSettings(
    @Body() settings: Record<string, { enabled: boolean }>,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.interestsService.saveNotificationSettings(user.id, settings);
  }
}
