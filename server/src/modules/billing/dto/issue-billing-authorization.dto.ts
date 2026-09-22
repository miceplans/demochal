import { IsString, Length } from 'class-validator';

export class IssueBillingAuthorizationDto {
  @IsString()
  @Length(1, 255)
  authKey!: string;
}
