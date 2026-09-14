import { IsNotEmpty, IsString } from 'class-validator';

export class RejectVerificationDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
