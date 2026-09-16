import { IsIn, IsString } from 'class-validator';

export class CreateReportDto {
  @IsString()
  content!: string;

  @IsIn(['challenge', 'team', 'award'])
  targetType!: 'challenge' | 'team' | 'award';

  @IsString()
  org!: string;

  @IsString()
  summary!: string;

  @IsString()
  detail!: string;
}
