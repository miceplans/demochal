import { IsIn } from 'class-validator';

const STATUSES = ['published', 'closed'] as const;

export class UpdateChallengeStatusDto {
  @IsIn(STATUSES)
  status!: (typeof STATUSES)[number];
}
