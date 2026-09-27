import { IsIn, IsString, Length, Matches, MaxLength } from 'class-validator';
import type { ContactChannel } from '../contact-verifications.service.js';

export class RequestContactVerificationDto {
  @IsIn(['email', 'phone'])
  channel!: ContactChannel;

  @IsString()
  @MaxLength(255)
  target!: string;
}

export class ConfirmContactVerificationDto {
  @IsString()
  @Length(6, 6)
  @Matches(/^\d{6}$/)
  code!: string;
}
