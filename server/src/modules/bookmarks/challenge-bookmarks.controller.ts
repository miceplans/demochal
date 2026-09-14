import { Body, Controller, Param, Put } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/current-user.decorator.js';
import { BookmarksService } from './bookmarks.service.js';
import { ToggleBookmarkDto } from './dto/toggle-bookmark.dto.js';

@Controller('challenges')
export class ChallengeBookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Put(':id/bookmark')
  toggle(@Param('id') id: string, @Body() dto: ToggleBookmarkDto, @CurrentUser() user: AuthUser) {
    return this.bookmarksService.toggle(user.id, id, dto.bookmarked);
  }
}
