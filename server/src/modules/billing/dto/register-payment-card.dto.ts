import { IsOptional, IsString, Length } from 'class-validator';

export class RegisterPaymentCardDto {
  @IsString()
  @Length(1, 255)
  billingKey!: string;

  @IsOptional()
  @IsString()
  @Length(1, 100)
  cardName?: string;

  /** Masked number from Toss's billing-key-issue response; raw card numbers never reach us. */
  @IsString()
  @Length(1, 30)
  maskedNumber!: string;
}
