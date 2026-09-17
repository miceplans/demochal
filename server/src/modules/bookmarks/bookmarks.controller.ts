import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator.js';
import type { AuthenticatedUser } from '../auth/jwt-auth.guard.js';
import { BookmarksService, type BookmarkSort } from './bookmarks.service.js';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  list(@Query('sort') sort: BookmarkSort = 'latest', @CurrentUser() user: AuthenticatedUser) {
    return this.bookmarksService.list(user.id, sort);
  }
}
