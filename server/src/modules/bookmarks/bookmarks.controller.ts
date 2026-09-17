import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BookmarksService, type BookmarkSort } from './bookmarks.service.js';

@Controller('bookmarks')
@UseGuards(JwtAuthGuard)
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  list(@Query('sort') sort: BookmarkSort = 'latest', @CurrentUser() user: AuthUser) {
    return this.bookmarksService.list(user.id, sort);
  }
}
