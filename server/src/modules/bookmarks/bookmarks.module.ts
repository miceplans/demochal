import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookmarksController } from './bookmarks.controller.js';
import { BookmarksService } from './bookmarks.service.js';
import { ChallengeBookmarksController } from './challenge-bookmarks.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [BookmarksController, ChallengeBookmarksController],
  providers: [BookmarksService],
  exports: [BookmarksService],
})
export class BookmarksModule {}
