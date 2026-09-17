import { Body, Controller, Param, Put, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BookmarksService } from './bookmarks.service.js';
import { ToggleBookmarkDto } from './dto/toggle-bookmark.dto.js';

@Controller('challenges')
@UseGuards(JwtAuthGuard)
export class ChallengeBookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Put(':id/bookmark')
  toggle(@Param('id') id: string, @Body() dto: ToggleBookmarkDto, @CurrentUser() user: AuthUser) {
    return this.bookmarksService.toggle(user.id, id, dto.bookmarked);
  }
}
