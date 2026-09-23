import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateReportDto {
  @IsIn(['challenge', 'team', 'award', 'user'])
  targetType!: 'challenge' | 'team' | 'award' | 'user';

  @IsOptional()
  @IsUUID()
  targetId?: string;

  @IsString()
  @MaxLength(200)
  summary!: string;

  @IsOptional()
  @IsString()
  detail?: string;

  @IsOptional()
  @IsUUID()
  reportedUserId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  org?: string;
}
