import { Body, Controller, Get, Param, Put, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard, type AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { BookmarksService } from './bookmarks.service.js';
import { ToggleBookmarkDto } from './dto/toggle-bookmark.dto.js';

@Controller()
@UseGuards(JwtAuthGuard)
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get('bookmarks')
  listMine(@CurrentUser() user: AuthenticatedUser, @Query('sort') sort?: 'deadline' | 'latest' | 'popular') {
    return this.bookmarksService.listForUser(user.id, sort);
  }

  @Put('challenges/:id/bookmark')
  toggle(
    @Param('id') challengeId: string,
    @Body() dto: ToggleBookmarkDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.bookmarksService.toggle(user.id, challengeId, dto.bookmarked);
  }
}
