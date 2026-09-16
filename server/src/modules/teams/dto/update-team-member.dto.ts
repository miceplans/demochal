import { IsIn } from 'class-validator';

export class UpdateTeamMemberDto {
  @IsIn(['accepted', 'rejected'])
  status!: 'accepted' | 'rejected';
}
