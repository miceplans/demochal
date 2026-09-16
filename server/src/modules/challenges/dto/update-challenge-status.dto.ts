import { IsIn } from 'class-validator';

export class UpdateChallengeStatusDto {
  @IsIn(['published', 'closed'])
  status!: 'published' | 'closed';
}
