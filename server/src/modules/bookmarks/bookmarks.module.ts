import { Module } from '@nestjs/common';
import { BookmarksController } from './bookmarks.controller.js';
import { BookmarksService } from './bookmarks.service.js';
import { FilesModule } from '../files/files.module.js';
import { ChallengeBookmarksController } from './challenge-bookmarks.controller.js';

@Module({
  imports: [FilesModule],
  controllers: [BookmarksController, ChallengeBookmarksController],
  providers: [BookmarksService],
  exports: [BookmarksService],
})
export class BookmarksModule {}
