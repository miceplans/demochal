import { IsIn } from 'class-validator';

export class UpdateEmailStatusDto {
  @IsIn(['open', 'pending', 'resolved'])
  status!: 'open' | 'pending' | 'resolved';
}
