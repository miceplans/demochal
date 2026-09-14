import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateApplicationDto {
  @IsOptional()
  @IsIn(['submitted', 'reviewing', 'needs_revision', 'accepted', 'rejected'])
  status?: 'submitted' | 'reviewing' | 'needs_revision' | 'accepted' | 'rejected';

  @IsOptional()
  @IsIn(['undecided', 'pass', 'fail'])
  evaluation?: 'undecided' | 'pass' | 'fail';

  @IsOptional()
  @IsString()
  managerMemo?: string;
}
