import { IsIn } from 'class-validator';

export class UpdateAdDto {
  @IsIn(['active', 'paused', 'ended'])
  status!: 'active' | 'paused' | 'ended';
}
