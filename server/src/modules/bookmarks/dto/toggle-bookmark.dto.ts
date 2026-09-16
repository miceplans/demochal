import { IsBoolean } from 'class-validator';

export class ToggleBookmarkDto {
  @IsBoolean()
  bookmarked!: boolean;
}
