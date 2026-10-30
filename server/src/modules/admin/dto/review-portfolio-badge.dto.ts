import { IsIn, IsString, MaxLength } from 'class-validator';

export class ReviewPortfolioBadgeDto {
  // 신청한 링크는 사용자 프로필 안에서 URL로 식별한다.
  @IsString()
  @MaxLength(500)
  url!: string;

  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';
}
