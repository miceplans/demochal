import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser, type AuthUser } from '../../common/auth/current-user.decorator.js';
import { BookmarksService, type BookmarkSort } from './bookmarks.service.js';

@Controller('bookmarks')
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Get()
  list(@Query('sort') sort: BookmarkSort = 'latest', @CurrentUser() user: AuthUser) {
    return this.bookmarksService.list(user.id, sort);
  }
}
