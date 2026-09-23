import { IsIn, IsOptional, IsUrl, MaxLength } from 'class-validator';

export class UpdateTeamMemberDto {
  @IsIn(['accepted', 'rejected'])
  status!: 'accepted' | 'rejected';

  // 합격자에게 전송할 채팅방 링크. 불합격에는 저장되지 않는다.
  @IsOptional()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  chatLink?: string;
}
