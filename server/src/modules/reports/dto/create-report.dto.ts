import { IsIn, IsString, MaxLength } from 'class-validator';

// Field set mirrors the reports table (drizzle 0004): org/detail are NOT NULL
// there, and the old targetId/reportedUserId inputs had no columns to land in.
export class CreateReportDto {
  @IsIn(['challenge', 'team', 'award'])
  targetType!: 'challenge' | 'team' | 'award';

  @IsString()
  @MaxLength(200)
  org!: string;

  @IsString()
  @MaxLength(300)
  summary!: string;

  @IsString()
  detail!: string;
}
