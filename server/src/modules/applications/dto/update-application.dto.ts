import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const STATUSES = ['submitted', 'reviewing', 'needs_revision', 'accepted', 'rejected'] as const;
const EVALUATIONS = ['undecided', 'pass', 'fail'] as const;

export class UpdateApplicationDto {
  @IsOptional()
  @IsIn(STATUSES)
  status?: (typeof STATUSES)[number];

  @IsOptional()
  @IsIn(EVALUATIONS)
  evaluation?: (typeof EVALUATIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  managerMemo?: string;
}
